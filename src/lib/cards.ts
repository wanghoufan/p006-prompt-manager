import type { Card, Version } from '@/lib/types'
import { nowIso, uid } from '@/lib/util'

export const MAX_VERSIONS = 10

/** 调取码规范化：小写、去首尾空白；非法字符返回空串 */
export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

/**
 * 正文格式规范化（左对齐风格，P3-6）：
 * ① 逐行去除前导 tab；
 * ② 纯空白行归一为空行；
 * ③ 非空行前导空格保留最多 4 个（超过部分 collapse），避免破坏 Markdown 列表嵌套 / 代码块缩进；
 * ④ 去掉首尾空行；
 * ⑤ 合并连续空行（最多保留 1 个空行 ≈ 2 个 \n）。
 */
export function normalizeBody(body: string): string {
  const lines = body.split(/\r?\n/).map((line) => {
    const noTab = line.replace(/^\t+/, '')
    const stripped = noTab.replace(/^ +/, '')
    if (stripped === '') return '' // 纯空白行 → 空行
    const lead = noTab.match(/^ */)?.[0] ?? ''
    const kept = lead.length > 4 ? 4 : lead.length
    return ' '.repeat(kept) + stripped
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

export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 3)
}

export interface CardDraft {
  title: string
  tagsText: string
  body: string
  rating: number
  code: string
  notes: string
}

export function cardDraftFrom(card: Card): CardDraft {
  return {
    title: card.title,
    tagsText: card.tags.join('、'),
    body: card.body,
    rating: card.rating,
    code: card.code ?? '',
    notes: card.notes ?? '',
  }
}

export interface CardDraftChanges {
  bodyChanged: boolean
  titleChanged: boolean
  tagsChanged: boolean
  ratingChanged: boolean
  codeChanged: boolean
  notesChanged: boolean
  anyChanged: boolean
}

export function cardDraftChanges(draft: CardDraft, card: Card): CardDraftChanges {
  const bodyChanged = draft.body !== card.body
  const titleChanged = draft.title.trim() !== card.title
  const tagsChanged = parseTags(draft.tagsText).join('|') !== card.tags.join('|')
  const ratingChanged = draft.rating !== card.rating
  const codeChanged = normalizeCode(draft.code) !== (card.code ?? '')
  const notesChanged = draft.notes !== (card.notes ?? '')
  return {
    bodyChanged,
    titleChanged,
    tagsChanged,
    ratingChanged,
    codeChanged,
    notesChanged,
    anyChanged: bodyChanged || titleChanged || tagsChanged || ratingChanged || codeChanged || notesChanged,
  }
}