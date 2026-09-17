/**
 * 待删标签 tombstone（本机持久化 `pm:pending-tag-deletes`，不建云端表、不改数据库结构）。
 *
 * 「标签删除后复活」的根因之一是删除意图只活在内存 state 里：云端删除失败 / 写队列中断 /
 * Realtime 旧快照回读时，本机已删的标签会被整体快照重新填回来。故删除动作同时落一条
 * tombstone，任何回填（云端快照 / 本机缓存 / 派生兜底）之前先按 id 剔除，直到云端删除被
 * 确认（含 0 行复核）才清除——删除意图因此跨刷新、跨重试存活。
 */

const PENDING_TAG_DELETES_KEY = 'pm:pending-tag-deletes'

/** 读取本机待删标签 id（损坏 / 不可用一律当空集，不阻塞主流程）。 */
export function readPendingTagDeletes(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(PENDING_TAG_DELETES_KEY)
    if (!raw) return new Set()
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

/** 覆盖写入待删标签 id；空集直接删键，避免长期残留无意义的空记录。 */
export function writePendingTagDeletes(ids: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return
  try {
    if (ids.size === 0) {
      localStorage.removeItem(PENDING_TAG_DELETES_KEY)
      return
    }
    localStorage.setItem(PENDING_TAG_DELETES_KEY, JSON.stringify([...ids]))
  } catch {
    // 配额满等：静默丢弃，不阻塞删除主流程
  }
}
