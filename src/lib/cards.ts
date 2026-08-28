import type { Card, Version } from '@/lib/types'
import { nowIso, uid } from '@/lib/util'

export const MAX_VERSIONS = 10

/** 调取码规范化：小写、去首尾空白；非法字符返回空串 */
export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

/** 来源链接仅允许可在浏览器中安全打开的 HTTP(S) URL。 */
export function isValidSourceUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeSourceUrl(raw: string): string {
  return raw.trim()
}

/**
 * 正文格式规范化（左对齐风格，P3-6 + P0-I 增强）：
 * ① 逐行去除前导 tab 和所有前导空格（粘贴内容靠左对齐）；
 * ② 纯空白行归一为空行；
 * ③ 去掉首尾空行；
 * ④ 合并连续空行（最多保留 1 个空行 ≈ 2 个 \n）。
 */
export function normalizeBody(body: string): string {
  const lines = body.split(/\r?\n/).map((line) => {
    const stripped = line.replace(/^[\t ]+/, '')
    return stripped
  })
  let start = 0
  let end = lines.length
  while (start < end && lines[start] === '') start++
  while (end > start && lines[end - 1] === '') end--
  const trimmed = lines.slice(start, end)
  if (trimmed.length === 0) return ''
  return trimmed.join('\n').replace(/\n{3,}/g, '\n\n')
}

export function createCard(body: string, title: string, tags: string[], code?: string | null): Card {
  const now = nowIso()
  return {
    id: uid(),
    title: title || '未命名提示词',
    body,
    tags,
    code: code ? normalizeCode(code) : null,
    rating: 0,
    copyCount: 0,
    thinkingSummary: null,
    notes: '',
    sourceUrl: '',
    versions: [],
    createdAt: now,
    updatedAt: now,
  }
}

function withVersion(card: Card, snapshotBody: string): Card {
  const version: Version = {
    id: uid(),
    body: snapshotBody,
    createdAt: nowIso(),
  }
  const versions = [...card.versions, version].slice(-MAX_VERSIONS)
  return { ...card, versions }
}

/** 仅保存正文，不生成版本快照（失焦自动保存路径） */
export function saveBodyOnly(card: Card, newBody: string): Card {
  const body = normalizeBody(newBody)
  if (body === card.body) return card
  return { ...card, body, updatedAt: nowIso() }
}

/** 保存正文并生成版本快照（手动保存 / Ctrl+Enter 路径）
 *  注意：允许 newBody === card.body（正文刚被失焦自动保存过、用户又主动点保存的场景），
 *  此时快照当前正文作为里程碑版本；是否建版由调用方依据「正文脏标记」决策。 */
export function saveBodyWithVersion(card: Card, newBody: string): Card {
  const body = normalizeBody(newBody)
  const withSnapshot = withVersion(card, card.body)
  return { ...withSnapshot, body, updatedAt: nowIso() }
}

export function rollbackToVersion(card: Card, versionId: string): Card {
  const version = card.versions.find((v) => v.id === versionId)
  if (!version) return card
  // 回滚是导航操作，不在历史里追加新条目；
  // 想保留「回滚前的当前正文」应在回滚前点保存
  return { ...card, body: version.body, updatedAt: nowIso() }
}

/** P0-1：AI 无法归类时丢弃的占位脏标签（trim 后命中即丢弃，大小写不敏感） */
export const DISCARD_TAGS = new Set(['无法分类', '未分类', '其他', '无', '无标签'])

/**
 * 标签数组归一（P0-1）：trim → 丢弃 DISCARD_TAGS 脏标签（大小写不敏感）→ 去空 → 去重
 * → 单标签截断 50 字（对齐交接 §31，1~50 字符）→ 最多 10 个；过滤后为空则保持 []（无标签状态正常展示）。
 * 供 AI 标签路径（ai.ts generateMeta）与新建卡片合并标签使用。
 *
 * 2026-08-28 修复：原 slice(0, 4) 会把「多agent编程」截成「多age」，是存量碎片标签的根因；
 * 现改为 50 字上限（与手动 parseTags 一致），根治「两套规则并存」导致的碎片重名（审计 §五 高风险）。
 */
export function normalizeTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((t) => t.trim())
        .filter((t) => t !== '')
        .filter((t) => !DISCARD_TAGS.has(t.toLowerCase())),
    ),
  ]
    .map((t) => t.slice(0, 50))
    .slice(0, 10)
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 10)
}

export interface CardDraft {
  title: string
  tagsText: string
  body: string
  rating: number
  code: string
  notes: string
  sourceUrl: string
}

export function cardDraftFrom(card: Card): CardDraft {
  return {
    title: card.title,
    tagsText: card.tags.join('、'),
    body: card.body,
    rating: card.rating,
    code: card.code ?? '',
    notes: card.notes ?? '',
    sourceUrl: card.sourceUrl ?? '',
  }
}

export interface CardDraftChanges {
  bodyChanged: boolean
  titleChanged: boolean
  tagsChanged: boolean
  ratingChanged: boolean
  codeChanged: boolean
  notesChanged: boolean
  sourceUrlChanged: boolean
  anyChanged: boolean
}

export function cardDraftChanges(draft: CardDraft, card: Card): CardDraftChanges {
  const bodyChanged = draft.body !== card.body
  const titleChanged = draft.title.trim() !== card.title
  const tagsChanged = parseTags(draft.tagsText).join('|') !== card.tags.join('|')
  const ratingChanged = draft.rating !== card.rating
  const codeChanged = normalizeCode(draft.code) !== (card.code ?? '')
  const notesChanged = draft.notes !== (card.notes ?? '')
  const sourceUrlChanged = normalizeSourceUrl(draft.sourceUrl) !== (card.sourceUrl ?? '')
  return {
    bodyChanged,
    titleChanged,
    tagsChanged,
    ratingChanged,
    codeChanged,
    notesChanged,
    sourceUrlChanged,
    anyChanged: bodyChanged || titleChanged || tagsChanged || ratingChanged || codeChanged || notesChanged || sourceUrlChanged,
  }
}
