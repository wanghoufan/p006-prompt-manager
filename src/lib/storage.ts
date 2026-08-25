import type { Card, Settings, Version } from '@/lib/types'
import { nowIso, uid } from '@/lib/util'

export const CARDS_KEY = 'prompt-manager:cards'
export const SETTINGS_KEY = 'prompt-manager:settings'

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
    Array.isArray(x.versions) &&
    x.versions.every(isVersion) &&
    isString(x.createdAt) &&
    isString(x.updatedAt)
  )
}

/** 归一化卡片：老数据缺 code/notes 字段时补默认值 */
function normalizeCard(c: Card): Card {
  return { ...c, code: c.code ?? null, notes: typeof c.notes === 'string' ? c.notes : '' }
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

const DEFAULT_SETTINGS: Settings = { thinkingSummaryPrompt: '' }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      thinkingSummaryPrompt:
        typeof parsed.thinkingSummaryPrompt === 'string' ? parsed.thinkingSummaryPrompt : '',
    }
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

export type ImportResult =
  | { ok: true; cards: Card[]; settings: Settings | null }
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
    body: string[]
  }

  const cards: Card[] = []
  let current: DraftCard | null = null
  let section: 'meta' | 'body' | 'summary' | 'notes' | 'versions' | null = null

  function flush() {
    if (!current) return
    const body = current.body.join('\n').trim()
    if (!body) return
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
        current.tags = value.split(/[,，、]+/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
      } else if (key === '调取码') {
        current.code = value && value !== '（未设置）' ? value.trim().toLowerCase() : null
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
  if (cards.length === 0) return { ok: false, error: '未在文件中找到卡片数据' }
  return { ok: true, cards, settings: null }
}

export function buildMarkdownExport(cards: Card[]): string {
  const lines: string[] = ['# 提示词库备份', '', `> 导出时间：${nowIso()}`, `> 卡片数：${cards.length}`, '']
  cards.forEach((c, i) => {
    lines.push(`## ${i + 1}. ${c.title}`, '')
    lines.push(`- 标签：${c.tags.join('、') || '（无）'}`)
    lines.push(`- 调取码：${c.code ?? '（未设置）'}`)
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
      for (const c of root.cards) {
        if (!isCard(c)) {
          return { ok: false, error: '存在结构不合法或字段类型错误的卡片' }
        }
      }
      const settings: Settings = { ...DEFAULT_SETTINGS }
      if (root.settings && typeof root.settings === 'object') {
        const s = root.settings as Record<string, unknown>
        if (typeof s.thinkingSummaryPrompt === 'string') {
          settings.thinkingSummaryPrompt = s.thinkingSummaryPrompt
        }
      }
      return { ok: true, cards: root.cards, settings }
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
let lastPushedVersion: number | null = null
let cacheCards: Card[] = []
let cacheSettings: Settings = { thinkingSummaryPrompt: '' }
let pushScheduled = false

function trySave(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// 合并推送：把最近一次的 cards/settings 在下一个微任务里推到服务端（去抖）。
function schedulePush() {
  if (!serverMode || pushScheduled) return
  pushScheduled = true
  Promise.resolve().then(() => {
    pushScheduled = false
    void pushToServer(cacheCards, cacheSettings)
  })
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

export async function loadFromServer(): Promise<{ cards: Card[]; settings: Settings } | null> {
  try {
    const res = await fetch(SYNC_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { cards?: unknown; settings?: unknown }
    const cards = Array.isArray(data.cards)
      ? (data.cards.filter(isCard).map(normalizeCard) as Card[])
      : []
    const settings: Settings =
      data.settings && typeof data.settings === 'object'
        ? (data.settings as Settings)
        : { thinkingSummaryPrompt: '' }
    serverMode = true
    return { cards, settings }
  } catch {
    serverMode = false
    return null
  }
}

export async function pushToServer(cards: Card[], settings: Settings): Promise<boolean> {
  if (!serverMode) return false
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards, settings }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { version?: number }
    if (typeof data.version === 'number') lastPushedVersion = data.version
    return true
  } catch {
    serverMode = false
    return false
  }
}

// 订阅服务端变更；远程有更新时通过 onRemote 回调把最新数据交回页面。
// 通过 lastPushedVersion 滤掉「自己刚推送」产生的回声，避免推送死循环。
export function subscribeSync(onRemote: (cards: Card[], settings: Settings) => void): () => void {
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
      if (r) onRemote(r.cards, r.settings)
    })
  }
  es.onerror = () => {
    // EventSource 会自动重连，这里无需处理
  }
  return () => es.close()
}