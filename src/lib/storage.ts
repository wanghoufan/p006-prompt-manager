import type { Card, Settings, Version, Tag, PromptTag } from '@/lib/types'
import { nowIso, uid } from '@/lib/util'
import { normalizeBody } from '@/lib/cards'
import { isTag, isPromptTag, normalizeTag } from '@/lib/tags'

export const CARDS_KEY = 'prompt-manager:cards'
export const SETTINGS_KEY = 'prompt-manager:settings'
export const TAGS_KEY = 'prompt-manager:tags'
export const PROMPT_TAGS_KEY = 'prompt-manager:promptTags'

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString)
}

function isVersion(v: unknown): v is Version {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return isString(x.id) && isString(x.body) && isString(x.createdAt)
}

export function isCard(v: unknown): v is Card {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return (
    isString(x.id) &&
    isString(x.title) &&
    isString(x.body) &&
    isStringArray(x.tags) &&
    (x.code === undefined || x.code === null || isString(x.code)) &&
    typeof x.rating === 'number' &&
    typeof x.copyCount === 'number' &&
    (x.thinkingSummary === null || isString(x.thinkingSummary)) &&
    (x.notes === undefined || isString(x.notes)) &&
    (x.sourceUrl === undefined || isString(x.sourceUrl)) &&
    Array.isArray(x.versions) &&
    x.versions.every(isVersion) &&
    isString(x.createdAt) &&
    isString(x.updatedAt)
  )
}

/** P3-5：描述单张卡片为何未通过 isCard 校验，用于导入跳过详情 */
function describeCardFailure(v: unknown): string {
  if (!v || typeof v !== 'object') return '不是合法的对象'
  const x = v as Record<string, unknown>
  const bad: string[] = []
  if (!isString(x.id)) bad.push('id')
  if (!isString(x.title)) bad.push('title')
  if (!isString(x.body)) bad.push('body')
  if (!isStringArray(x.tags)) bad.push('tags')
  if (typeof x.rating !== 'number') bad.push('rating')
  if (typeof x.copyCount !== 'number') bad.push('copyCount')
  if (!(x.code === undefined || x.code === null || isString(x.code))) bad.push('code')
  if (!(x.thinkingSummary === null || isString(x.thinkingSummary))) bad.push('thinkingSummary')
  if (!(x.notes === undefined || isString(x.notes))) bad.push('notes')
  if (!(x.sourceUrl === undefined || isString(x.sourceUrl))) bad.push('sourceUrl')
  if (!Array.isArray(x.versions) || !x.versions.every(isVersion)) bad.push('versions')
  if (!isString(x.createdAt)) bad.push('createdAt')
  if (!isString(x.updatedAt)) bad.push('updatedAt')
  return bad.length ? `字段缺失/类型错误：${bad.join('、')}` : '结构不合法'
}

/** 归一化卡片：老数据缺可选字段时补默认值 */
function normalizeCard(c: Card): Card {
  return {
    ...c,
    code: c.code ?? null,
    notes: typeof c.notes === 'string' ? c.notes : '',
    sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : '',
  }
}

export function loadCards(): Card[] {
  try {
    const raw = localStorage.getItem(CARDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCard).map(normalizeCard)
  } catch {
    return []
  }
}

export function saveCards(cards: Card[]): boolean {
  cacheCards = cards
  const ok = trySave(CARDS_KEY, cards)
  if (ok) schedulePush()
  return ok
}

const DEFAULT_SETTINGS: Settings = {
  thinkingSummaryPrompt: '',
  confirmDelete: true,
  theme: 'system',
  autoFormatBody: false,
  bodyAlignment: 'left',
  composerAddMode: 'auto',
  hoverPreview: false,
  aiProvider: 'deepseek',
  aiModel: 'deepseek-v4-flash',
  aiApiKey: '',
  aiBaseUrl: '',
}

const AI_PROVIDERS = [
  'deepseek',
  'zhipu',
  'tencent',
  'doubao',
  'kimi',
  'google',
  'openai',
  'openrouter',
] as const

/** 设置归一化（P0-4/P0-5）：老数据缺 confirmDelete / theme 字段时补默认值；
 *  theme 仅接受 'dark' | 'light' | 'system'，其余（含 undefined）回退 'system'。
 *  通用AI配置（Phase 2）：缺 ai* 字段时补默认值，非法服务商回退 deepseek。 */
function normalizeSettings(v: unknown): Settings {
  const s = (v && typeof v === 'object' ? v : {}) as Partial<Settings>
  const theme = s.theme === 'dark' || s.theme === 'light' || s.theme === 'system' ? s.theme : 'system'
  const bodyAlignment = s.bodyAlignment === 'center' || s.bodyAlignment === 'right' ? s.bodyAlignment : 'left'
  const composerAddMode = s.composerAddMode === 'manual' ? 'manual' : 'auto'
  const aiProvider = (AI_PROVIDERS as readonly string[]).includes(s.aiProvider ?? '')
    ? (s.aiProvider as Settings['aiProvider'])
    : 'deepseek'
  const aiModel = typeof s.aiModel === 'string' && s.aiModel.trim() ? s.aiModel : 'deepseek-v4-flash'
  return {
    thinkingSummaryPrompt: typeof s.thinkingSummaryPrompt === 'string' ? s.thinkingSummaryPrompt : '',
    confirmDelete: typeof s.confirmDelete === 'boolean' ? s.confirmDelete : true,
    theme,
    autoFormatBody: typeof s.autoFormatBody === 'boolean' ? s.autoFormatBody : false,
    bodyAlignment,
    composerAddMode,
    hoverPreview: typeof s.hoverPreview === 'boolean' ? s.hoverPreview : false,
    aiProvider,
    aiModel,
    aiApiKey: typeof s.aiApiKey === 'string' ? s.aiApiKey : '',
    aiBaseUrl: typeof s.aiBaseUrl === 'string' ? s.aiBaseUrl : '',
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  cacheSettings = settings
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore quota errors for settings
  }
  schedulePush()
}

// ===================== 标签集合（tags / promptTags）本地持久化 =====================
// 与 cards/settings 同走「localStorage 兜底 + 推送到服务端」链路。

export function loadTags(): Tag[] {
  try {
    const raw = localStorage.getItem(TAGS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTag).map(normalizeTag)
  } catch {
    return []
  }
}

export function saveTags(tags: Tag[]): void {
  cacheTags = tags
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags))
  } catch {
    // ignore quota errors
  }
  schedulePush()
}

export function loadPromptTags(): PromptTag[] {
  try {
    const raw = localStorage.getItem(PROMPT_TAGS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPromptTag)
  } catch {
    return []
  }
}

export function savePromptTags(promptTags: PromptTag[]): void {
  cachePromptTags = promptTags
  try {
    localStorage.setItem(PROMPT_TAGS_KEY, JSON.stringify(promptTags))
  } catch {
    // ignore quota errors
  }
  schedulePush()
}

export type SkippedCard = { title: string; reason: string }

export type ImportResult =
  | { ok: true; cards: Card[]; settings: Settings | null; skipped?: SkippedCard[] }
  | { ok: false; error: string }

function parseMarkdownImport(raw: string): ImportResult | null {
  const lines = raw.split(/\r?\n/)
  if (!lines[0]?.trim().startsWith('# 提示词库备份')) return null

  interface DraftCard {
    title: string
    tags: string[]
    rating: number
    copyCount: number
    code: string | null
    createdAt: string
    updatedAt: string
    summary: string | null
    notes: string
    sourceUrl: string
    body: string[]
  }

  const cards: Card[] = []
  const skipped: SkippedCard[] = []
  let current: DraftCard | null = null
  let section: 'meta' | 'body' | 'summary' | 'notes' | 'versions' | null = null

  function flush() {
    if (!current) return
    const body = normalizeBody(current.body.join('\n'))
    if (!body) {
      // P3-5：正文为空的卡片不导入，记录跳过原因
      skipped.push({ title: current.title || '(无标题)', reason: '正文为空' })
      current = null
      section = null
      return
    }
    cards.push({
      id: uid(),
      title: current.title,
      body,
      tags: current.tags,
      code: current.code ? current.code.toLowerCase() : null,
      rating: Math.max(0, Math.min(5, current.rating)),
      copyCount: Math.max(0, current.copyCount),
      thinkingSummary: current.summary ? current.summary.trim() : null,
      notes: current.notes,
      sourceUrl: current.sourceUrl,
      versions: [],
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    })
    current = null
    section = null
  }

  for (const line of lines) {
    const cardMatch = /^##\s+\d+\.\s+(.+)$/.exec(line)
    if (cardMatch) {
      flush()
      current = {
        title: cardMatch[1].trim(),
        tags: [],
        rating: 0,
        copyCount: 0,
        code: null,
        createdAt: '',
        updatedAt: '',
        summary: null,
        notes: '',
        sourceUrl: '',
        body: [],
      }
      section = 'meta'
      continue
    }
    if (!current) continue
    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) {
      const name = h3[1].trim()
      section =
        name === '正文' ? 'body' :
        name === '思维总结' ? 'summary' :
        name === '备注' ? 'notes' :
        name === '版本历史' ? 'versions' : null
      continue
    }
    if (section === 'body') {
      current.body.push(line)
      continue
    }
    if (section === 'summary') {
      current.summary = (current.summary ?? '') + (current.summary ? '\n' : '') + line
      continue
    }
    if (section === 'notes') {
      current.notes = current.notes + (current.notes ? '\n' : '') + line
      continue
    }
    if (section === 'meta') {
      const meta = /^-\s+([^:：]+)[:：]\s*(.*)$/.exec(line)
      if (!meta) continue
      const key = meta[1].trim()
      const value = meta[2].trim()
      if (key === '标签') {
        current.tags = value.split(/[,，、]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10)
      } else if (key === '调取码') {
        current.code = value && value !== '（未设置）' ? value.trim().toLowerCase() : null
      } else if (key === '来源链接') {
        current.sourceUrl = value && value !== '（未设置）' ? value : ''
      } else if (key === '评分') {
        const n = Number(value)
        if (!Number.isNaN(n)) current.rating = n
      } else if (key === '复制次数') {
        const n = Number(value)
        if (!Number.isNaN(n)) current.copyCount = n
      } else if (key === '创建时间') {
        current.createdAt = value
      } else if (key === '更新时间') {
        current.updatedAt = value
      }
    }
  }
  flush()
  if (cards.length === 0) {
    const reason = skipped.length > 0 ? `全部 ${skipped.length} 张卡片正文为空` : '未在文件中找到卡片数据'
    return { ok: false, error: reason }
  }
  return { ok: true, cards, settings: null, skipped: skipped.length ? skipped : undefined }
}

export function buildMarkdownExport(cards: Card[]): string {
  const lines: string[] = ['# 提示词库备份', '', `> 导出时间：${nowIso()}`, `> 卡片数：${cards.length}`, '']
  cards.forEach((c, i) => {
    lines.push(`## ${i + 1}. ${c.title}`, '')
    lines.push(`- 标签：${c.tags.join('、') || '（无）'}`)
    lines.push(`- 调取码：${c.code ?? '（未设置）'}`)
    lines.push(`- 来源链接：${c.sourceUrl || '（未设置）'}`)
    lines.push(`- 评分：${c.rating}`)
    lines.push(`- 复制次数：${c.copyCount}`)
    lines.push(`- 创建时间：${c.createdAt}`)
    lines.push(`- 更新时间：${c.updatedAt}`, '')
    lines.push('### 正文', '', c.body, '')
    if (c.notes) {
      lines.push('### 备注', '', c.notes, '')
    }
    if (c.thinkingSummary) {
      lines.push('### 思维总结', '', c.thinkingSummary, '')
    }
    if (c.versions.length > 0) {
      lines.push('### 版本历史', '')
      for (const v of [...c.versions].reverse()) {
        const snippet = v.body.length > 60 ? `${v.body.slice(0, 60)}…` : v.body
        lines.push(`- ${v.createdAt}：${snippet}`)
      }
      lines.push('')
    }
    if (i < cards.length - 1) lines.push('---', '')
  })
  return lines.join('\n')
}

export function parseImport(raw: string): ImportResult {
  let data: unknown = null
  try {
    data = JSON.parse(raw)
  } catch {
    // fall through to Markdown parsing
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const root = data as Record<string, unknown>
    if (Array.isArray(root.cards)) {
      // P3-5：部分导入——结构合法的卡片入库，非法的记录跳过原因而非整体失败
      const valid: Card[] = []
      const skipped: SkippedCard[] = []
      for (const c of root.cards) {
        if (isCard(c)) {
          valid.push({ ...c, body: normalizeBody(c.body) })
        } else {
          const raw = c as Record<string, unknown>
          const rawTitle = isString(raw.title) ? raw.title : ''
          skipped.push({
            title: rawTitle.trim() || '(无标题)',
            reason: describeCardFailure(c),
          })
        }
      }
      if (valid.length === 0) {
        return {
          ok: false,
          error: `全部 ${skipped.length} 张卡片结构不合法或字段类型错误`,
        }
      }
      const settings: Settings = normalizeSettings(root.settings)
      return { ok: true, cards: valid, settings, skipped: skipped.length ? skipped : undefined }
    }
  }
  return parseMarkdownImport(raw) ?? { ok: false, error: '既不是有效的 JSON 备份，也不是 Markdown 备份' }
}

// ===================== 服务端实时同步层 =====================
// 服务端（同一份 Next.js 进程）持有共享数据；本层负责把本地变更合并推上去，
// 并订阅 SSE 在另一台电脑改动时实时拉取最新数据。
// 本地 localStorage 仍作为离线兜底。

const SYNC_URL = '/api/sync'
const STREAM_URL = '/api/sync/stream'

let serverMode = false
/** P0-A 版本号提交：本次本地快照基于的服务端版本。loadFromServer/pushToServer 成功后同步更新。 */
let knownVersion: number | null = null
let lastPushedVersion: number | null = null
let cacheCards: Card[] = []
let cacheSettings: Settings = { ...DEFAULT_SETTINGS }
let cacheTags: Tag[] = []
let cachePromptTags: PromptTag[] = []
let pushInFlight = false
let pushPending = false

/** P0-A 冲突回调：版本冲突并刷新到服务端权威数据后，通知页面重载视图并提示用户。 */
let onConflictRefresh: ((data: ServerSnapshot) => void) | null = null

function trySave(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// 合并推送：把「同一渲染批次」内多次 save 合并为一次推送，保证每次推送快照内部一致。
// 背景（P0 重命名根因）：rename/delete 等操作会同时变更 cards + tags（+ promptTags），
// page.tsx 四个持久化 effect 在同一 flush 内依次执行（saveCards 先于 saveTags）；
// 若每个 save 都立即发推送，先执行的 saveCards 会用「新 cards + 旧 cacheTags」的混合
// 快照推上去，服务端落盘后 SSE 回声早于 POST 响应到达（lastPushedVersion 未更新、
// 回声过滤失效），客户端 loadFromServer 把旧 tags 拉回 → 重命名被回滚（实测全部未生效）。
// 解法：schedulePush 延迟到宏任务（setTimeout 0）真正发推送，同一 flush 的所有 save
// 在首次触发前已全部写完模块级 cache，任何一次推送都是四集合一致的快照。
// 串行化：上一次推送尚未完成时，新变更只标记 pending，完成后立即补推一次最新状态，
// 保证高频改动最终一致、不丢中间态（原实现用 pushScheduled 防重入，异步期间新变更会被吞掉）。
let pushTimer: ReturnType<typeof setTimeout> | null = null

function schedulePush() {
  if (!serverMode) return
  if (pushTimer) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    if (pushInFlight) {
      pushPending = true
      return
    }
    pushInFlight = true
    void doPush()
  }, 0)
}

async function doPush() {
  try {
    const result = await pushToServer(cacheCards, cacheSettings, cacheTags, cachePromptTags)
    if (result === 'conflict') {
      // P0-A 版本已变化：拒绝本次写入 → 刷新到服务端权威数据（更新 knownVersion）→ 基于最新版本重试。
      // 本地刚执行的未落盘操作由冲突回调通知页面重载视图，用户可见并可按需重做。
      const fresh = await loadFromServer()
      if (fresh) {
        onConflictRefresh?.(fresh)
        await pushToServer(fresh.cards, fresh.settings, fresh.tags, fresh.promptTags)
      }
    }
  } finally {
    pushInFlight = false
    if (pushPending) {
      pushPending = false
      schedulePush()
    }
  }
}

export async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(SYNC_URL, { method: 'GET', cache: 'no-store' })
    serverMode = res.ok
  } catch {
    serverMode = false
  }
  return serverMode
}

export type ServerSnapshot = {
  cards: Card[]
  settings: Settings
  tags: Tag[]
  promptTags: PromptTag[]
  version: number | null
}

/** P0-A 净化关联：剔除指向不存在卡片/标签的关系并去重，保证推送到服务端的数据满足
 *  「关联不悬空 + (prompt_id, tag_id) 唯一」，避免服务端校验拒绝（自愈旧数据产生的悬空关系）。 */
export function sanitizePromptTags(promptTags: PromptTag[], cards: Card[], tags: Tag[]): PromptTag[] {
  const cardIds = new Set(cards.map((c) => c.id))
  const tagIds = new Set(tags.map((t) => t.id))
  const seen = new Set<string>()
  const out: PromptTag[] = []
  for (const rt of promptTags) {
    if (!cardIds.has(rt.prompt_id) || !tagIds.has(rt.tag_id)) continue
    const key = `${rt.prompt_id}\u0000${rt.tag_id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(rt)
  }
  return out
}

export async function loadFromServer(): Promise<ServerSnapshot | null> {
  try {
    const res = await fetch(SYNC_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as {
      cards?: unknown
      settings?: unknown
      tags?: unknown
      promptTags?: unknown
      version?: unknown
    }
    const cards = Array.isArray(data.cards)
      ? (data.cards.filter(isCard).map(normalizeCard) as Card[])
      : []
    const settings: Settings = normalizeSettings(data.settings)
    const tags = Array.isArray(data.tags) ? (data.tags.filter(isTag).map(normalizeTag) as Tag[]) : []
    const promptTags = Array.isArray(data.promptTags) ? (data.promptTags.filter(isPromptTag) as PromptTag[]) : []
    serverMode = true
    // 同步 push 缓存为服务端权威数据，避免后续 doPush 把空/旧 tags 覆盖回服务端
    cacheCards = cards
    cacheSettings = settings
    cacheTags = tags
    // 净化悬空/重复关联后再入缓存与视图，杜绝旧数据污染计数与触发服务端校验拒绝
    const cleanPromptTags = sanitizePromptTags(promptTags, cards, tags)
    cachePromptTags = cleanPromptTags
    if (typeof data.version === 'number') knownVersion = data.version
    return { cards, settings, tags, promptTags: cleanPromptTags, version: typeof data.version === 'number' ? data.version : null }
  } catch {
    serverMode = false
    return null
  }
}

export type PushResult = 'ok' | 'conflict' | 'error'

export async function pushToServer(
  cards: Card[],
  settings: Settings,
  tags: Tag[] = [],
  promptTags: PromptTag[] = [],
): Promise<PushResult> {
  if (!serverMode) return 'error'
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // P0-A 带版本号提交：声明本次写入基于 knownVersion；服务端版本已变化则 409/拒绝
      body: JSON.stringify({
        cards,
        settings,
        tags,
        promptTags: sanitizePromptTags(promptTags, cards, tags),
        baseVersion: knownVersion,
      }),
    })
    if (!res.ok) {
      serverMode = false
      return 'error'
    }
    const data = (await res.json()) as { version?: unknown }
    if (typeof data.version === 'number') {
      knownVersion = data.version
      lastPushedVersion = data.version
      return 'ok'
    }
    // 服务端拒绝时 route.ts 恒为 200，setState 的 union 结果透传在 version 字段内
    const err = data.version as { ok?: boolean; error?: string; conflict?: boolean } | undefined
    if (err && err.ok === false) return err.conflict ? 'conflict' : 'error'
    serverMode = false
    return 'error'
  } catch {
    serverMode = false
    return 'error'
  }
}

/** 注册/注销版本冲突回调（冲突刷新后通知页面重载视图并提示）。 */
export function setConflictRefreshHandler(cb: ((data: ServerSnapshot) => void) | null) {
  onConflictRefresh = cb
}

// 订阅服务端变更；远程有更新时通过 onRemote 回调把最新数据交回页面。
// 通过 lastPushedVersion 滤掉「自己刚推送」产生的回声，避免推送死循环。
export function subscribeSync(
  onRemote: (cards: Card[], settings: Settings, tags: Tag[], promptTags: PromptTag[]) => void,
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => {}
  const es = new EventSource(STREAM_URL)
  es.onmessage = (ev) => {
    let version: number | null = null
    try {
      const data = JSON.parse(ev.data) as { version?: number }
      version = typeof data.version === 'number' ? data.version : null
    } catch {
      return
    }
    if (version === null) return
    if (lastPushedVersion !== null && version === lastPushedVersion) return // 自己的回声，忽略
    void loadFromServer().then((r) => {
      if (r) onRemote(r.cards, r.settings, r.tags, r.promptTags)
    })
  }
  es.onerror = () => {
    // EventSource 会自动重连，这里无需处理
  }
  return () => es.close()
}
