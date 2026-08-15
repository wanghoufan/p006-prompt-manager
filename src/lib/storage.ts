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
    typeof x.rating === 'number' &&
    typeof x.copyCount === 'number' &&
    (x.thinkingSummary === null || isString(x.thinkingSummary)) &&
    Array.isArray(x.versions) &&
    x.versions.every(isVersion) &&
    isString(x.createdAt) &&
    isString(x.updatedAt)
  )
}

export function loadCards(): Card[] {
  try {
    const raw = localStorage.getItem(CARDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCard)
  } catch {
    return []
  }
}

export function saveCards(cards: Card[]): boolean {
  try {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards))
    return true
  } catch {
    return false
  }
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
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore quota errors for settings
  }
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
    createdAt: string
    updatedAt: string
    summary: string | null
    body: string[]
  }

  const cards: Card[] = []
  let current: DraftCard | null = null
  let section: 'meta' | 'body' | 'summary' | 'versions' | null = null

  function flush() {
    if (!current) return
    const body = current.body.join('\n').trim()
    if (!body) return
    cards.push({
      id: uid(),
      title: current.title,
      body,
      tags: current.tags,
      rating: Math.max(0, Math.min(5, current.rating)),
      copyCount: Math.max(0, current.copyCount),
      thinkingSummary: current.summary ? current.summary.trim() : null,
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
        createdAt: '',
        updatedAt: '',
        summary: null,
        body: [],
      }
      section = 'meta'
      continue
    }
    if (!current) continue
    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) {
      const name = h3[1].trim()
      section = name === '正文' ? 'body' : name === '思维总结' ? 'summary' : name === '版本历史' ? 'versions' : null
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
    if (section === 'meta') {
      const meta = /^-\s+([^:：]+)[:：]\s*(.*)$/.exec(line)
      if (!meta) continue
      const key = meta[1].trim()
      const value = meta[2].trim()
      if (key === '标签') {
        current.tags = value.split(/[,，、]+/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
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
    lines.push(`- 评分：${c.rating}`)
    lines.push(`- 复制次数：${c.copyCount}`)
    lines.push(`- 创建时间：${c.createdAt}`)
    lines.push(`- 更新时间：${c.updatedAt}`, '')
    lines.push('### 正文', '', c.body, '')
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