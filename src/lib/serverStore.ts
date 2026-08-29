import { promises as fs } from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import type { Tag, PromptTag } from './types'
import { isTag, isPromptTag, validateTagGraph } from './tags'

// 服务端共享存储：进程内单例 + JSON 文件持久化。
// 两台电脑访问同一份 Next.js 服务，因此读写的是同一个文件，天然共享。
// 变更通过 EventEmitter 广播版本号，由 SSE 推送给各客户端实现实时同步。

export interface ServerState {
  cards: unknown[]
  settings: unknown
  tags: unknown[]
  promptTags: unknown[]
  version: number
}

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'store.json')

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

/** P1-AI1：清洗 settings，剥离 aiApiKey，保证 API Key 永不落盘 / 永不出现在共享快照中。 */
function sanitizeSettings(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v
  const out: Record<string, unknown> = { ...(v as Record<string, unknown>) }
  delete out.aiApiKey
  return out
}

let state: ServerState | null = null
let writeChain: Promise<void> = Promise.resolve()

async function ensureLoaded(): Promise<ServerState> {
  if (state) return state
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<ServerState>
    state = {
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      settings: sanitizeSettings(parsed.settings ?? null),
      // 迁移后新增集合：旧文件缺省时为空数组；守卫过滤非法结构（isTag/isPromptTag）
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter(isTag) : [],
      promptTags: Array.isArray(parsed.promptTags) ? parsed.promptTags.filter(isPromptTag) : [],
      version: typeof parsed.version === 'number' ? parsed.version : 1,
    }
  } catch {
    state = { cards: [], settings: null, tags: [], promptTags: [], version: 1 }
  }
  return state
}

export async function getState(): Promise<ServerState> {
  const s = await ensureLoaded()
  // 返回副本，避免调用方意外修改内存中的单例；settings 二次清洗，杜绝历史残留 Key 外泄
  return {
    cards: s.cards,
    settings: sanitizeSettings(s.settings),
    tags: s.tags,
    promptTags: s.promptTags,
    version: s.version,
  }
}

/** setState 的返回：成功返回新版本号；校验/版本冲突返回错误对象（由 /api/sync 透传）。 */
export type SetStateResult = number | { ok: false; error: string; conflict?: boolean }

export async function setState(next: {
  cards: unknown[]
  settings: unknown
  tags?: unknown[]
  promptTags?: unknown[]
  /** P0-A 版本号提交：客户端声明本次写入基于的版本；已变化则拒绝并刷新后重试 */
  baseVersion?: number
}): Promise<SetStateResult> {
  const s = await ensureLoaded()
  const nextTags = Array.isArray(next.tags) ? next.tags.filter(isTag) : s.tags
  const nextPromptTags = Array.isArray(next.promptTags) ? next.promptTags.filter(isPromptTag) : s.promptTags
  // P1-AI1：API Key 只存在于本机 localStorage，写入共享存储前剥离
  const nextSettings = sanitizeSettings(next.settings)

  // P0-A 服务端写入前校验：父级存在 / 无环 / 同父无重名 / 关联不悬空 / (prompt_id, tag_id) 唯一。
  // 非法数据一律拒绝落盘，防止整份快照「最后写入覆盖」污染共享库。
  const cardIds = new Set<string>()
  for (const c of next.cards) {
    if (c && typeof c === 'object') {
      const id = (c as Record<string, unknown>).id
      if (typeof id === 'string') cardIds.add(id)
    }
  }
  const invalid = validateTagGraph(nextTags as Tag[], nextPromptTags as PromptTag[], cardIds)
  if (invalid) {
    return { ok: false, error: `数据校验失败：${invalid}` }
  }

  const current = JSON.stringify({
    cards: s.cards,
    settings: s.settings,
    tags: s.tags,
    promptTags: s.promptTags,
  })
  const incoming = JSON.stringify({
    cards: next.cards,
    settings: nextSettings,
    tags: nextTags,
    promptTags: nextPromptTags,
  })
  if (current === incoming) {
    // 内容无变化：保持版本号、不落盘、不广播，避免远程回写导致的推送死循环
    return s.version
  }
  // P0-A 版本号提交：内容有变化且声明的基础版本落后于当前版本 → 拒绝（乐观并发控制，防丢更新）
  if (typeof next.baseVersion === 'number' && next.baseVersion !== s.version) {
    return {
      ok: false,
      error: `版本已变化（当前 ${s.version}，提交基于 ${next.baseVersion}），请刷新后重试`,
      conflict: true,
    }
  }
  s.cards = next.cards
  s.settings = nextSettings
  s.tags = nextTags
  s.promptTags = nextPromptTags
  s.version += 1
  const snapshot = JSON.stringify(s, null, 2)
  writeChain = writeChain
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(DATA_FILE, snapshot, 'utf8')
    })
    .catch((err) => {
      console.error('[serverStore] 写入失败:', err)
    })
  emitter.emit('change', s.version)
  return s.version
}

export function subscribe(cb: (version: number) => void): () => void {
  emitter.on('change', cb)
  return () => emitter.off('change', cb)
}

/**
 * 按调取码给卡片复制次数 +1（供 MCP 调用时计数，与手动复制共用 copyCount）。
 * 找到卡片返回新的 copyCount；未找到返回 null。
 * 会 bump 版本号并广播 SSE，其他端实时刷新。
 */
export async function incrementCopy(code: string): Promise<number | null> {
  const s = await ensureLoaded()
  const cards = s.cards as Array<Record<string, unknown>>
  const idx = cards.findIndex((c) => String(c.code ?? '').toLowerCase() === code)
  if (idx < 0) return null
  const card = cards[idx]
  const count = typeof card.copyCount === 'number' ? card.copyCount : 0
  card.copyCount = count + 1
  s.version += 1
  const snapshot = JSON.stringify(s, null, 2)
  writeChain = writeChain
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(DATA_FILE, snapshot, 'utf8')
    })
    .catch((err) => {
      console.error('[serverStore] 写入失败:', err)
    })
  emitter.emit('change', s.version)
  return count + 1
}
