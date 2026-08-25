import type { Card, Version } from '@/lib/types'
import { nowIso, uid } from '@/lib/util'

export const MAX_VERSIONS = 10

/** 调取码规范化：小写、去首尾空白；非法字符返回空串 */
export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
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

export function saveBodyWithVersion(card: Card, newBody: string): Card {
  if (newBody === card.body) return card
  const withSnapshot = withVersion(card, card.body)
  return { ...withSnapshot, body: newBody, updatedAt: nowIso() }
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