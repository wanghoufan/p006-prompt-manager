import { promises as fs } from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import { isTag, isPromptTag } from './tags'

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

let state: ServerState | null = null
let writeChain: Promise<void> = Promise.resolve()

async function ensureLoaded(): Promise<ServerState> {
  if (state) return state
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<ServerState>
    state = {
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      settings: parsed.settings ?? null,
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
  // 返回副本，避免调用方意外修改内存中的单例
  return { cards: s.cards, settings: s.settings, tags: s.tags, promptTags: s.promptTags, version: s.version }
}

export async function setState(next: {
  cards: unknown[]
  settings: unknown
  tags?: unknown[]
  promptTags?: unknown[]
}): Promise<number> {
  const s = await ensureLoaded()
  const nextTags = Array.isArray(next.tags) ? next.tags.filter(isTag) : s.tags
  const nextPromptTags = Array.isArray(next.promptTags) ? next.promptTags.filter(isPromptTag) : s.promptTags
  const current = JSON.stringify({
    cards: s.cards,
    settings: s.settings,
    tags: s.tags,
    promptTags: s.promptTags,
  })
  const incoming = JSON.stringify({
    cards: next.cards,
    settings: next.settings,
    tags: nextTags,
    promptTags: nextPromptTags,
  })
  if (current === incoming) {
    // 内容无变化：保持版本号、不落盘、不广播，避免远程回写导致的推送死循环
    return s.version
  }
  s.cards = next.cards
  s.settings = next.settings
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
