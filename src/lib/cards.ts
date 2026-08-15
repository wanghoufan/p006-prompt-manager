import type { Card, Version } from '@/lib/types'
import { nowIso, uid } from '@/lib/util'

export const MAX_VERSIONS = 10

export function createCard(body: string, title: string, tags: string[]): Card {
  const now = nowIso()
  return {
    id: uid(),
    title: title || '未命名提示词',
    body,
    tags,
    rating: 0,
    copyCount: 0,
    thinkingSummary: null,
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
  const withSnapshot = withVersion(card, card.body)
  return { ...withSnapshot, body: version.body, updatedAt: nowIso() }
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 3)
}

export interface CardDraft {
  title: string
  tagsText: string
  body: string
  rating: number
}

export function cardDraftFrom(card: Card): CardDraft {
  return { title: card.title, tagsText: card.tags.join('、'), body: card.body, rating: card.rating }
}

export interface CardDraftChanges {
  bodyChanged: boolean
  titleChanged: boolean
  tagsChanged: boolean
  ratingChanged: boolean
  anyChanged: boolean
}

export function cardDraftChanges(draft: CardDraft, card: Card): CardDraftChanges {
  const bodyChanged = draft.body !== card.body
  const titleChanged = draft.title.trim() !== card.title
  const tagsChanged = parseTags(draft.tagsText).join('|') !== card.tags.join('|')
  const ratingChanged = draft.rating !== card.rating
  return {
    bodyChanged,
    titleChanged,
    tagsChanged,
    ratingChanged,
    anyChanged: bodyChanged || titleChanged || tagsChanged || ratingChanged,
  }
}