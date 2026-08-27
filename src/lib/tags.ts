// 标签系统纯函数库（客户端/服务端共享，无副作用）。
// 数据模型对齐交接 §38：tags 实体 + prompt_tags 关联，二者与 Prompt 完全解耦。
// 所有 mutation 返回「新对象」，由调用方决定如何落盘/广播，保证：
//   - 删除标签只删关系（promptTags），绝不删 Prompt（交接 §40）
//   - 重命名/移动只改 Tag 自身字段，不改任何 Prompt 正文（交接 §3/§7/§9）
//   - 应用层强制 (prompt_id, tag_id) 唯一（等效 SQL UNIQUE）
//   - 树形结构防循环（交接 §43）

import type { Tag, PromptTag, Card } from './types'
import { nowIso, uid } from './util'

// ===================== 守卫 =====================

export function isTag(v: unknown): v is Tag {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    (x.parent_id === null || typeof x.parent_id === 'string') &&
    (x.icon === null || x.icon === undefined || typeof x.icon === 'string') &&
    (x.is_pinned === undefined || typeof x.is_pinned === 'boolean') &&
    (x.sort_order === undefined || typeof x.sort_order === 'number') &&
    typeof x.created_at === 'string' &&
    typeof x.updated_at === 'string'
  )
}

export function isPromptTag(v: unknown): v is PromptTag {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return typeof x.prompt_id === 'string' && typeof x.tag_id === 'string'
}

/** 归一化 Tag：老数据缺 icon/is_pinned/sort_order 时补默认值 */
export function normalizeTag(t: Tag): Tag {
  return {
    ...t,
    parent_id: t.parent_id ?? null,
    icon: t.icon ?? null,
    is_pinned: typeof t.is_pinned === 'boolean' ? t.is_pinned : false,
    sort_order: typeof t.sort_order === 'number' ? t.sort_order : 0,
  }
}

// ===================== 工具 =====================

/** 生成稳定且唯一的 tag id（tag_ 前缀 + uuid） */
export function newTagId(): string {
  return `tag_${uid()}`
}

export function newTag(name: string, parentId: string | null = null): Tag {
  const now = nowIso()
  return {
    id: newTagId(),
    name: name.trim(),
    parent_id: parentId,
    icon: null,
    is_pinned: false,
    sort_order: 0,
    created_at: now,
    updated_at: now,
  }
}

/** 同父级下 name 唯一校验（交接 §28）；不同父级允许同名（§29）。excludeId 用于重命名时排除自身。 */
export function isNameUnique(tags: Tag[], parentId: string | null, name: string, excludeId?: string): boolean {
  const n = name.trim()
  return !tags.some((t) => t.id !== excludeId && t.parent_id === parentId && t.name === n)
}

/** 收集某标签的全部后代 id（不含自身）。parent 环异常时仍能终止（visited 兜底）。 */
export function collectDescendantIds(tags: Tag[], tagId: string): Set<string> {
  const result = new Set<string>()
  const stack = [tagId]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const t of tags) {
      if (t.parent_id === cur && !visited.has(t.id)) {
        result.add(t.id)
        stack.push(t.id)
      }
    }
  }
  return result
}

/** 父链环检测（交接 §43）：禁止成为自己的父 / 移到自己的子节点 / 成环。
 *  返回 true 表示「合法，不构成循环」。 */
export function assertNoCycle(tags: Tag[], tagId: string, newParentId: string | null): boolean {
  if (newParentId === null) return true
  if (newParentId === tagId) return false // ① 不能成为自己的父
  const children = new Set(tags.filter((t) => t.parent_id === tagId).map((t) => t.id))
  if (children.has(newParentId)) return false // ② 不能移到自己的子节点
  let cur: string | null = newParentId
  const guard = new Set<string>()
  while (cur !== null) {
    if (guard.has(cur)) return false // 数据异常兜底
    guard.add(cur)
    if (cur === tagId) return false // ③ 成环
    cur = tags.find((t) => t.id === cur)?.parent_id ?? null
  }
  return true
}

/** 完整路径（交接 §29：同名不同父级用完整路径区分） */
export function tagPath(tags: Tag[], tagId: string, sep = ' / '): string {
  const byId = new Map(tags.map((t) => [t.id, t]))
  const parts: string[] = []
  let cur: string | null = tagId
  const guard = new Set<string>()
  while (cur !== null && !guard.has(cur)) {
    guard.add(cur)
    const t = byId.get(cur)
    if (!t) break
    parts.unshift(t.name)
    cur = t.parent_id
  }
  return parts.join(sep)
}

// ===================== 关联关系计算 =====================

/** 直接关联某标签的 prompt 数（不含子标签） */
export function directCount(promptTags: PromptTag[], tagId: string): number {
  return promptTags.filter((rt) => rt.tag_id === tagId).length
}

/** 某标签（含后代）去重后的 prompt 集合 */
export function collectTagPromptIds(promptTags: PromptTag[], tagIds: Set<string>): Set<string> {
  const ids = new Set<string>()
  for (const rt of promptTags) {
    if (tagIds.has(rt.tag_id)) ids.add(rt.prompt_id)
  }
  return ids
}

/** 某标签子树（含自身）关联的去重 prompt 总数 */
export function totalCount(promptTags: PromptTag[], tagIds: Set<string>): number {
  return collectTagPromptIds(promptTags, tagIds).size
}

/** 某 prompt 关联的标签 id 列表（按 promptTags 数组顺序去重） */
export function tagIdsOfPrompt(promptTags: PromptTag[], promptId: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const rt of promptTags) {
    if (rt.prompt_id === promptId && !seen.has(rt.tag_id)) {
      seen.add(rt.tag_id)
      out.push(rt.tag_id)
    }
  }
  return out
}

/** 由 promptTags 关联把 tag 名回填到 Card.tags（保持方案 A 冗余一致，供导出/离线兜底使用） */
export function promptTagNamesOf(
  tags: Tag[],
  promptTags: PromptTag[],
  promptId: string,
): string[] {
  const byId = new Map(tags.map((t) => [t.id, t]))
  return tagIdsOfPrompt(promptTags, promptId)
    .map((id) => byId.get(id)?.name)
    .filter((n): n is string => Boolean(n))
}

/** 以 promptTags 关联为唯一真源，重建所有卡片的 Card.tags 冗余字段（方案 A 双写一致）。
 *  仅当名字数组发生变化时才生成新对象，避免无谓渲染。 */
export function syncCardsToPromptTags(cards: Card[], tags: Tag[], promptTags: PromptTag[]): Card[] {
  return cards.map((c) => {
    const names = promptTagNamesOf(tags, promptTags, c.id)
    const same = names.length === c.tags.length && names.every((n, i) => n === c.tags[i])
    return same ? c : { ...c, tags: names }
  })
}

// ===================== Mutation 纯函数 =====================

/** 创建标签。返回 [新 tags 数组, 新 tag]。不做重名/空名校验（由调用方先 isNameUnique）。 */
export function createTag(tags: Tag[], name: string, parentId: string | null = null): [Tag[], Tag] {
  const tag = newTag(name, parentId)
  return [[...tags, tag], tag]
}

/** 全局重命名（交接 §7）：仅改 Tag.name，返回新 tags；Prompt 与关系均不动。 */
export function renameTag(tags: Tag[], tagId: string, newName: string): Tag[] {
  return tags.map((t) => (t.id === tagId ? { ...t, name: newName.trim(), updated_at: nowIso() } : t))
}

/** 移动标签（交接 §9）：仅改 parent_id，返回新 tags；关系不动。调用方先 assertNoCycle + isNameUnique。 */
export function moveTag(tags: Tag[], tagId: string, newParentId: string | null): Tag[] {
  return tags.map((t) =>
    t.id === tagId ? { ...t, parent_id: newParentId, updated_at: nowIso() } : t,
  )
}

/**
 * 删除标签（交接 §40）：先级联删关系，再删实体，绝不删 Prompt。
 * @param withDescendants 是否连带删除整棵子树（否则仅删自身，子标签上提一级，交接 §12 模式 A/B）
 * 返回新的 tags 与 promptTags（二者原子替换，由调用方一并落盘）。
 */
export function deleteTag(
  tags: Tag[],
  promptTags: PromptTag[],
  tagId: string,
  withDescendants = false,
): { tags: Tag[]; promptTags: PromptTag[] } {
  const target = tags.find((t) => t.id === tagId)
  if (!target) return { tags, promptTags }

  let removedIds: Set<string>
  let nextTags: Tag[]
  if (withDescendants) {
    removedIds = new Set([tagId, ...collectDescendantIds(tags, tagId)])
    nextTags = tags.filter((t) => !removedIds.has(t.id))
  } else {
    removedIds = new Set([tagId])
    // 子标签提升一级到被删标签的原父级（交接 §12 模式 A）
    nextTags = tags
      .filter((t) => t.id !== tagId)
      .map((t) => (t.parent_id === tagId ? { ...t, parent_id: target.parent_id } : t))
  }

  const nextPromptTags = promptTags.filter((rt) => !removedIds.has(rt.tag_id))
  return { tags: nextTags, promptTags: nextPromptTags }
}

/** 原子替换某 prompt 的全部标签关系（交接 §38 唯一约束：去重 + 覆盖式整体替换）。 */
export function setCardTags(promptTags: PromptTag[], promptId: string, tagIds: string[]): PromptTag[] {
  const unique = [...new Set(tagIds)]
  return [
    ...promptTags.filter((rt) => rt.prompt_id !== promptId),
    ...unique.map((tagId) => ({ prompt_id: promptId, tag_id: tagId })),
  ]
}

/** 给某 prompt 追加一个标签关系（若已存在则幂等）。 */
export function addCardTag(promptTags: PromptTag[], promptId: string, tagId: string): PromptTag[] {
  if (promptTags.some((rt) => rt.prompt_id === promptId && rt.tag_id === tagId)) return promptTags
  return [...promptTags, { prompt_id: promptId, tag_id: tagId }]
}

/** 从某 prompt 移除一个标签关系（交接 §13：仅解除该卡与该标签的关联，标签实体保留）。 */
export function removeCardTag(promptTags: PromptTag[], promptId: string, tagId: string): PromptTag[] {
  return promptTags.filter((rt) => !(rt.prompt_id === promptId && rt.tag_id === tagId))
}

// ===================== 树构建 =====================

export interface TagNode extends Tag {
  /** 子树内去重 prompt 总数（含自身直接关联 + 所有后代） */
  total: number
  /** 直接关联数（不含后代） */
  direct: number
  depth: number
}

/** 按 parent_id 构建有序树（同级按 sort_order 升序 + 名称 locale 排序；环引用安全兜底跳过）。 */
export function buildTagTree(tags: Tag[], promptTags: PromptTag[]): TagNode[] {
  const children = new Map<string | null, Tag[]>()
  for (const t of tags) {
    const key = t.parent_id
    const arr = children.get(key) ?? []
    arr.push(t)
    children.set(key, arr)
  }
  const sortSiblings = (arr: Tag[]) =>
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh'))

  // 计算每个标签子树的去重 prompt 总数（「自身 + 全部后代」关联 prompt 精确去重）
  const totalOf = new Map<string, number>()
  function compute(tag: Tag): number {
    const subIds = new Set([tag.id, ...collectDescendantIds(tags, tag.id)])
    const n = totalCount(promptTags, subIds)
    totalOf.set(tag.id, n)
    return n
  }

  const roots = sortSiblings(children.get(null) ?? [])
  // 环引用兜底：某标签父链最终不落在 null 根上时，作为额外根挂出，避免整段丢失
  const seenInTree = new Set<string>()
  const walk = (list: Tag[], depth: number): TagNode[] => {
    const out: TagNode[] = []
    for (const t of sortSiblings(list)) {
      if (seenInTree.has(t.id)) continue
      seenInTree.add(t.id)
      compute(t)
      out.push({
        ...t,
        total: totalOf.get(t.id) ?? 0,
        direct: directCount(promptTags, t.id),
        depth,
      })
    }
    return out
  }

  const result = walk(roots, 0)
  // 兜底：未被遍历到的孤立标签（环或悬空 parent）作为顶级追加
  const orphans = tags.filter((t) => !seenInTree.has(t.id))
  if (orphans.length > 0) {
    for (const t of sortSiblings(orphans)) {
      if (seenInTree.has(t.id)) continue
      seenInTree.add(t.id)
      compute(t)
      result.push({
        ...t,
        total: totalOf.get(t.id) ?? 0,
        direct: directCount(promptTags, t.id),
        depth: 0,
      })
    }
  }
  return result
}

/** 某标签的子树节点（含自身），用于渲染嵌套子级。 */
export function childrenOf(tags: Tag[], parentId: string | null): Tag[] {
  return tags
    .filter((t) => t.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh'))
}

/** 兜底派生：当 tags 集合为空但 cards.tags 仍有字符串标签时（demo 视图 / 未跑迁移的旧数据），
 *  从 cards.tags 去重派生临时 tags + promptTags，保证 UI 不丢标签。所有标签为顶级、无层级。 */
export function deriveTagsFromCards(cards: Card[]): { tags: Tag[]; promptTags: PromptTag[] } {
  const nameSet = new Set<string>()
  for (const c of cards) {
    for (const t of c.tags) {
      const n = t.trim()
      if (n) nameSet.add(n)
    }
  }
  const nameToId = new Map<string, string>()
  const tags: Tag[] = []
  let i = 0
  for (const name of [...nameSet].sort((a, b) => a.localeCompare(b, 'zh'))) {
    i += 1
    const id = `tag_derive_${i}`
    nameToId.set(name, id)
    const now = nowIso()
    tags.push({ id, name, parent_id: null, icon: null, is_pinned: false, sort_order: 0, created_at: now, updated_at: now })
  }
  const promptTags: PromptTag[] = []
  for (const c of cards) {
    const seen = new Set<string>()
    for (const t of c.tags) {
      const n = t.trim()
      if (!n || seen.has(n)) continue
      seen.add(n)
      const id = nameToId.get(n)
      if (id) promptTags.push({ prompt_id: c.id, tag_id: id })
    }
  }
  return { tags, promptTags }
}
