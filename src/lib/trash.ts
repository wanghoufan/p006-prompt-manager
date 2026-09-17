import type { Card, PromptTag, Tag } from '@/lib/types'

/**
 * 回收站（本机持久化，不建云端表、不改数据库结构）。
 * 删除动作照常硬删云端行；本站只留快照用于恢复，恢复走正常保存链路重新上云。
 */

export interface TrashCardEntry {
  kind: 'card'
  id: string
  deletedAt: string
  title: string
  cards: Card[]
  relations: PromptTag[]
}

export interface TrashTagEntry {
  kind: 'tag'
  id: string
  deletedAt: string
  title: string
  tags: Tag[]
  relations: PromptTag[]
}

export type TrashEntry = TrashCardEntry | TrashTagEntry

const TRASH_KEY = 'pm:trash'
const TRASH_MAX = 100

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `trash-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

export function newTrashId(): string {
  return uid()
}

export function readTrash(): TrashEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TRASH_KEY)
    if (!raw) return []
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (e): e is TrashEntry =>
        typeof e === 'object' &&
        e !== null &&
        ((e as TrashEntry).kind === 'card' || (e as TrashEntry).kind === 'tag'),
    )
  } catch {
    return []
  }
}

export function writeTrash(entries: TrashEntry[]): void {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(entries.slice(0, TRASH_MAX)))
  } catch {
    // 配额满等：静默丢弃，不阻塞删除主流程
  }
}
