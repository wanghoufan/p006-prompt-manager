'use client'

import { useMemo, useState } from 'react'
import type { Tag, PromptTag, TagFilters } from '@/lib/types'
import { childrenOf, collectDescendantIds, directCount, totalCount, tagPath } from '@/lib/tags'

export interface TagPanelProps {
  tags: Tag[]
  promptTags: PromptTag[]
  /** 全部卡片数（「全部」计数） */
  total: number
  /** 无标签卡片数（「无标签」计数） */
  untaggedCount: number
  filters: TagFilters
  onSelectTag: (id: string) => void
  onToggleUntagged: () => void
  onIncludeDescendantsChange: (value: boolean) => void
  onResetFilters: () => void
  offline?: boolean
  /** demo/只读视图不传以下操作回调（隐藏管理入口） */
  onCreateTag?: (name: string, parentId: string | null) => { ok: boolean; error?: string }
  onRenameTag?: (id: string, name: string) => { ok: boolean; error?: string }
  onMoveTag?: (id: string, parentId: string | null) => { ok: boolean; error?: string }
  onReorderTag?: (id: string, targetId: string, position: 'before' | 'after') => { ok: boolean; error?: string }
  onDeleteTag?: (id: string, mode: 'self' | 'subtree') => void
  onMergeTag?: (sourceId: string, targetId: string) => { ok: boolean; error?: string }
}

const EXPAND_KEY = 'pm:tag-expanded'

function readExpanded(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(EXPAND_KEY)
    if (!raw) return new Set()
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeExpanded(set: Set<string>) {
  try {
    localStorage.setItem(EXPAND_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

/** 内联弹出菜单（重命名/移动/新建子标签/删除） */
function TagMenu({
  onRename,
  onMove,
  onMerge,
  onCreateChild,
  onDelete,
  onClose,
}: {
  onRename: () => void
  onMove: () => void
  onMerge: () => void
  onCreateChild: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <>
      <button
        type="button"
        aria-label="关闭标签菜单"
        className="fixed inset-0 z-20 cursor-default"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md border border-line bg-ink-850 py-1 text-xs shadow-xl shadow-black/40">
        <button
          type="button"
          className="block w-full px-3 py-1.5 text-left text-paper-dim hover:bg-ink-800 hover:text-paper"
          onClick={() => {
            onCreateChild()
            onClose()
          }}
        >
          ＋ 新建子标签
        </button>
        <button
          type="button"
          className="block w-full px-3 py-1.5 text-left text-paper-dim hover:bg-ink-800 hover:text-paper"
          onClick={() => {
            onRename()
            onClose()
          }}
        >
          ✎ 重命名
        </button>
        <button
          type="button"
          className="block w-full px-3 py-1.5 text-left text-paper-dim hover:bg-ink-800 hover:text-paper"
          onClick={() => {
            onMove()
            onClose()
          }}
        >
          ↗ 移动标签
        </button>
        <button
          type="button"
          className="block w-full px-3 py-1.5 text-left text-paper-dim hover:bg-ink-800 hover:text-paper"
          onClick={() => {
            onMerge()
            onClose()
          }}
        >
          ⇄ 合并到标签
        </button>
        <div className="my-1 h-px bg-line" />
        <button
          type="button"
          className="block w-full px-3 py-1.5 text-left text-rust hover:bg-rust/10"
          onClick={() => {
            onDelete()
            onClose()
          }}
        >
          🗑 删除标签
        </button>
      </div>
    </>
  )
}

interface TreeNodeProps {
  tag: Tag
  tags: Tag[]
  promptTags: PromptTag[]
  depth: number
  expanded: Set<string>
  filters: TagFilters
  onSelectTag: (id: string) => void
  onToggle: (id: string) => void
  editable: boolean
  onRename: (tag: Tag) => void
  onMove: (tag: Tag) => void
  onMerge: (tag: Tag) => void
  onCreateChild: (tag: Tag) => void
  onDelete: (tag: Tag) => void
  draggable: boolean
  draggedId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: (sourceId: string, target: Tag, position: 'before' | 'after' | 'on') => void
}

function TreeNode({
  tag,
  tags,
  promptTags,
  depth,
  expanded,
  filters,
  onSelectTag,
  onToggle,
  editable,
  onRename,
  onMove,
  onMerge,
  onCreateChild,
  onDelete,
  draggable,
  draggedId,
  onDragStart,
  onDragEnd,
  onDrop,
}: TreeNodeProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const kids = childrenOf(tags, tag.id)
  const hasKids = kids.length > 0
  const isExpanded = expanded.has(tag.id)
  const active = filters.any.includes(tag.id)
  const direct = directCount(promptTags, tag.id)
  const subIds = useMemo(() => new Set([tag.id, ...collectDescendantIds(tags, tag.id)]), [tags, tag.id])
  const total = totalCount(promptTags, subIds)

  return (
    <div>
      <div
        draggable={draggable}
        onDragStart={(e) => {
          if (!draggable) return
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', tag.id)
          onDragStart(tag.id)
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          if (draggable && draggedId && draggedId !== tag.id) e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          const sourceId = e.dataTransfer.getData('text/plain') || draggedId
          if (!sourceId || sourceId === tag.id) return
          const bounds = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientY - bounds.top) / bounds.height
          onDrop(sourceId, tag, ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'on')
        }}
        className={`group relative flex w-full items-center gap-1 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
          active ? 'bg-gold/10' : 'hover:bg-ink-800'
        } ${draggedId === tag.id ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${0.625 + depth * 1}rem` }}
      >
        {hasKids ? (
          <button
            type="button"
            aria-label={isExpanded ? '收起子标签' : '展开子标签'}
            className="shrink-0 rounded p-0.5 text-muted hover:text-paper"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(tag.id)
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span aria-hidden className="w-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelectTag(tag.id)}
          className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
            active ? 'text-gold-bright' : 'text-paper-dim group-hover:text-paper'
          }`}
          title={tagPath(tags, tag.id)}
        >
          <span className="min-w-0 flex-1 truncate">{tag.name}</span>
          <span
            className={`shrink-0 font-mono text-xs ${active ? 'text-gold' : 'text-muted'}`}
            title={direct !== total ? `直接 ${direct} · 含子 ${total}` : `关联 ${total} 条`}
          >
            {total}
          </span>
        </button>
        {editable && (
          <button
            type="button"
            aria-label={`标签 ${tag.name} 更多操作`}
            className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-ink-700 hover:text-paper focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
              <circle cx="3" cy="8" r="1.3" />
              <circle cx="8" cy="8" r="1.3" />
              <circle cx="13" cy="8" r="1.3" />
            </svg>
          </button>
        )}
        {menuOpen && (
          <TagMenu
            onRename={() => onRename(tag)}
            onMove={() => onMove(tag)}
            onMerge={() => onMerge(tag)}
            onCreateChild={() => onCreateChild(tag)}
            onDelete={() => onDelete(tag)}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
      {hasKids && isExpanded && (
        <div>
          {kids.map((k) => (
            <TreeNode
              key={k.id}
              tag={k}
              tags={tags}
              promptTags={promptTags}
              depth={depth + 1}
              expanded={expanded}
              filters={filters}
              onSelectTag={onSelectTag}
              onToggle={onToggle}
              editable={editable}
              onRename={onRename}
              onMove={onMove}
              onMerge={onMerge}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              draggable={draggable}
              draggedId={draggedId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TagPanel({
  tags,
  promptTags,
  total,
  untaggedCount,
  filters,
  onSelectTag,
  onToggleUntagged,
  onIncludeDescendantsChange,
  onResetFilters,
  offline,
  onCreateTag,
  onRenameTag,
  onMoveTag,
  onReorderTag,
  onDeleteTag,
  onMergeTag,
}: TagPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpanded())
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropChoice, setDropChoice] = useState<{ sourceId: string; targetId: string } | null>(null)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeExpanded(next)
      return next
    })
  }

  const editable = Boolean(onCreateTag && onRenameTag && onMoveTag && onDeleteTag)
  const filterCount = filters.any.length + (filters.untaggedOnly ? 1 : 0)

  const roots = useMemo(() => childrenOf(tags, null), [tags])

  // 标签搜索：匹配 name 或完整路径，命中后平铺展示完整路径（交接 §17）
  const searchTerm = search.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!searchTerm) return []
    return tags
      .filter((t) => {
        const p = tagPath(tags, t.id).toLowerCase()
        return t.name.toLowerCase().includes(searchTerm) || p.includes(searchTerm)
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  }, [tags, searchTerm])

  function promptForName(title: string, initial = ''): string | null {
    return window.prompt(title, initial)
  }

  function handleCreate(parentId: string | null) {
    if (!onCreateTag) return
    const name = promptForName(parentId ? '新建子标签名称：' : '新建标签名称：')
    if (name === null) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('标签名称不能为空')
      return
    }
    const r = onCreateTag(trimmed, parentId)
    if (!r.ok) {
      setError(r.error ?? '创建失败')
      return
    }
    setError(null)
    // 新建标签自动展开其父节点，便于看到
    if (parentId) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(parentId)
        writeExpanded(next)
        return next
      })
    }
  }

  function handleRename(tag: Tag) {
    if (!onRenameTag) return
    const name = promptForName(`重命名标签「${tag.name}」为：`, tag.name)
    if (name === null) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('标签名称不能为空')
      return
    }
    if (trimmed === tag.name) return
    // 检测同级同名：存在时提供合并选项
    const duplicate = tags.find((t) => t.id !== tag.id && t.parent_id === tag.parent_id && t.name === trimmed)
    if (duplicate && onMergeTag) {
      const useCount = totalCount(promptTags, new Set([tag.id, ...collectDescendantIds(tags, tag.id)]))
      const dupCount = totalCount(promptTags, new Set([duplicate.id, ...collectDescendantIds(tags, duplicate.id)]))
      if (
        window.confirm(
          `同级下已存在标签「${trimmed}」。\n\n` +
            `· 当前标签「${tag.name}」关联 ${useCount} 条提示词\n` +
            `· 目标标签「${duplicate.name}」关联 ${dupCount} 条提示词\n\n` +
            `点击「确定」将两标签合并（关联 + 子标签全部转移到「${duplicate.name}」，当前标签删除）\n` +
            `点击「取消」取消操作`,
        )
      ) {
        const r = onMergeTag(tag.id, duplicate.id)
        if (!r.ok) {
          setError(r.error ?? '合并失败')
          return
        }
        setError(null)
      }
      return
    }
    const r = onRenameTag(tag.id, trimmed)
    if (!r.ok) {
      setError(r.error ?? '重命名失败')
      return
    }
    setError(null)
  }

  function handleMerge(tag: Tag) {
    if (!onMergeTag) return
    const descendantIds = collectDescendantIds(tags, tag.id)
    const candidates = tags.filter((candidate) => candidate.id !== tag.id && !descendantIds.has(candidate.id))
    if (candidates.length === 0) {
      setError('没有可合并的目标标签')
      return
    }
    const targetInput = promptForName(
      `将「${tagPath(tags, tag.id)}」合并到哪个标签？\n请输入完整路径（例如：开发 / 前端）；同名时必须输入完整路径。`,
    )
    if (targetInput === null) return
    const trimmed = targetInput.trim()
    if (!trimmed) {
      setError('请选择要合并到的目标标签')
      return
    }
    const exactPathMatches = candidates.filter((candidate) => tagPath(tags, candidate.id) === trimmed)
    const nameMatches = candidates.filter((candidate) => candidate.name === trimmed)
    const matches = exactPathMatches.length > 0 ? exactPathMatches : nameMatches
    if (matches.length === 0) {
      setError(`未找到标签「${trimmed}」`)
      return
    }
    if (matches.length > 1) {
      setError(`存在多个「${trimmed}」，请使用完整路径`)
      return
    }
    const target = matches[0]
    const sourceCount = totalCount(promptTags, new Set([tag.id, ...descendantIds]))
    const targetCount = totalCount(
      promptTags,
      new Set([target.id, ...collectDescendantIds(tags, target.id)]),
    )
    if (
      !window.confirm(
        `确认将「${tagPath(tags, tag.id)}」合并到「${tagPath(tags, target.id)}」？\n\n` +
          `源标签关联 ${sourceCount} 条提示词，目标标签关联 ${targetCount} 条提示词。\n` +
          '源标签的关联会迁移并自动去重，源标签将被删除；提示词不会被删除。',
      )
    ) {
      return
    }
    const result = onMergeTag(tag.id, target.id)
    if (!result.ok) {
      setError(result.error ?? '合并失败')
      return
    }
    setError(null)
  }

  function handleMove(tag: Tag) {
    if (!onMoveTag) return
    // 输入目标父标签名称（留空 = 移到顶级）；同名标签按第一个匹配（P0 简化）
    const targetName = promptForName(
      `移动「${tag.name}」到哪个父标签下？（留空 = 移到顶级）\n当前父级：${tag.parent_id ? tagPath(tags, tag.parent_id) : '（顶级）'}`,
    )
    if (targetName === null) return
    let parentId: string | null = null
    const trimmed = targetName.trim()
    if (trimmed) {
      const parent = tags.find((t) => t.name === trimmed && t.id !== tag.id)
      if (!parent) {
        setError(`未找到名为「${trimmed}」的标签`)
        return
      }
      parentId = parent.id
    }
    const r = onMoveTag(tag.id, parentId)
    if (!r.ok) {
      setError(r.error ?? '移动失败')
      return
    }
    setError(null)
    // 展开新父级，便于看到移动结果
    if (parentId) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(parentId)
        writeExpanded(next)
        return next
      })
    }
  }

  function handleDelete(tag: Tag) {
    if (!onDeleteTag) return
    const useCount = totalCount(promptTags, new Set([tag.id, ...collectDescendantIds(tags, tag.id)]))
    const hasKids = childrenOf(tags, tag.id).length > 0
    const confirmMsg = [
      `删除标签「${tag.name}」？`,
      '',
      `当前有 ${useCount} 条提示词使用此标签${hasKids ? '（或其子标签）' : ''}。`,
      '',
      '删除后：',
      '• 该标签及其关联会被移除',
      '• 提示词本身不会被删除',
      '• 其他标签不受影响',
    ].join('\n')
    if (!window.confirm(confirmMsg)) return

    let mode: 'self' | 'subtree' = 'self'
    if (hasKids) {
      const childNames = childrenOf(tags, tag.id).map((c) => c.name).join('、')
      mode = window.confirm(
        `「${tag.name}」下存在子标签：${childNames}\n\n点「确定」= 删除整棵子树（含子标签）\n点「取消」= 仅删除当前标签（子标签提升一级）`,
      )
        ? 'subtree'
        : 'self'
    }
    onDeleteTag(tag.id, mode)
    setError(null)
  }

  function handleDrop(sourceId: string, target: Tag, position: 'before' | 'after' | 'on') {
    setDraggedId(null)
    if (position === 'on') {
      setDropChoice({ sourceId, targetId: target.id })
      return
    }
    const result = onReorderTag?.(sourceId, target.id, position)
    if (!result?.ok) setError(result?.error ?? '标签排序失败')
    else setError(null)
  }

  function resolveDropChoice(action: 'child' | 'merge') {
    if (!dropChoice) return
    const { sourceId, targetId } = dropChoice
    const source = tags.find((tag) => tag.id === sourceId)
    const target = tags.find((tag) => tag.id === targetId)
    if (!source || !target) {
      setError('标签已不存在，请重试')
      setDropChoice(null)
      return
    }
    const result = action === 'child' ? onMoveTag?.(sourceId, targetId) : onMergeTag?.(sourceId, targetId)
    if (!result?.ok) setError(result?.error ?? '操作失败')
    else setError(null)
    setDropChoice(null)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-ink-900/60">
      <div className="flex items-center justify-between px-4 pb-1 pt-5">
        <span className="font-serif text-xs tracking-[0.2em] text-muted">标签</span>
        {editable && (
          <button
            type="button"
            aria-label="新建标签"
            title="新建标签"
            className="rounded p-1 text-muted transition-colors hover:bg-ink-800 hover:text-gold-bright"
            onClick={() => handleCreate(null)}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="space-y-2 border-b border-line/70 px-3 pb-3 pt-1">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <label className="flex cursor-pointer items-center gap-1.5 text-paper-dim">
            <input type="checkbox" checked={filters.includeDescendants} onChange={(e) => onIncludeDescendantsChange(e.target.checked)} className="accent-gold" />
            包含子标签
          </label>
          {filterCount > 0 && <button type="button" className="text-muted hover:text-gold-bright" onClick={onResetFilters}>重置</button>}
        </div>
        <p className="text-[10px] leading-relaxed text-muted">单击标签筛选，再次单击取消。拖到上/下边缘排序，拖到标签上可设为子标签或合并。</p>
      </div>
      {editable && (
        <div className="px-3 pb-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标签…"
            className="field px-2.5 py-1 text-xs"
            aria-label="搜索标签"
          />
        </div>
      )}
      {error && (
        <div className="mx-3 mb-1 rounded-md border border-rust/40 bg-rust/10 px-2 py-1 text-[11px] leading-relaxed text-rust">
          {error}
        </div>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" aria-label="标签筛选">
        <div
          className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
            filterCount === 0 ? 'bg-gold/10' : 'hover:bg-ink-800'
          }`}
          onClick={onResetFilters}
        >
          <span aria-hidden className="w-4 shrink-0" />
          <span className={`min-w-0 flex-1 truncate ${filterCount === 0 ? 'text-gold-bright' : 'text-paper-dim'}`}>
            全部
          </span>
          <span className={`shrink-0 font-mono text-xs ${filterCount === 0 ? 'text-gold' : 'text-muted'}`}>
            {total}
          </span>
        </div>

        {searchTerm ? (
          searchResults.length === 0 ? (
            <p className="px-2.5 py-3 text-xs leading-relaxed text-muted">未找到匹配的标签。</p>
          ) : (
            searchResults.map((t) => {
              const active = filters.any.includes(t.id)
              return (
                <div
                  key={t.id}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    active ? 'bg-gold/10' : 'hover:bg-ink-800'
                  }`}
                  onClick={() => onSelectTag(t.id)}
                >
                  <span aria-hidden className="w-4 shrink-0" />
                  <span
                    className={`min-w-0 flex-1 truncate ${active ? 'text-gold-bright' : 'text-paper-dim'}`}
                    title={tagPath(tags, t.id)}
                  >
                    {tagPath(tags, t.id)}
                  </span>
                  <span className={`shrink-0 font-mono text-xs ${active ? 'text-gold' : 'text-muted'}`}>
                    {totalCount(promptTags, new Set([t.id, ...collectDescendantIds(tags, t.id)]))}
                  </span>
                </div>
              )
            })
          )
        ) : (
          <>
            {roots.map((t) => (
              <TreeNode
                key={t.id}
                tag={t}
                tags={tags}
                promptTags={promptTags}
                depth={0}
                expanded={expanded}
                filters={filters}
                onSelectTag={onSelectTag}
                onToggle={toggle}
                editable={editable}
                onRename={handleRename}
                onMove={handleMove}
                onMerge={handleMerge}
                onCreateChild={(tag) => handleCreate(tag.id)}
                onDelete={handleDelete}
                draggable={editable}
                draggedId={draggedId}
                onDragStart={setDraggedId}
                onDragEnd={() => setDraggedId(null)}
                onDrop={handleDrop}
              />
            ))}
            <div className="my-1 h-px bg-line/60" />
            <div
              className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                filters.untaggedOnly ? 'bg-gold/10' : 'hover:bg-ink-800'
              }`}
              onClick={onToggleUntagged}
            >
              <span aria-hidden className="w-4 shrink-0" />
              <span className={`min-w-0 flex-1 truncate ${filters.untaggedOnly ? 'text-gold-bright' : 'text-paper-dim'}`}>
                无标签
              </span>
              <span className={`shrink-0 font-mono text-xs ${filters.untaggedOnly ? 'text-gold' : 'text-muted'}`}>
                {untaggedCount}
              </span>
            </div>
          </>
        )}
      </nav>
      {dropChoice && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="标签拖拽操作">
          <div className="w-full max-w-sm rounded-xl border border-line bg-ink-900 p-4 shadow-2xl">
            <p className="text-sm text-paper">将「{tagPath(tags, dropChoice.sourceId)}」放到「{tagPath(tags, dropChoice.targetId)}」</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">选择建立层级或合并；两种操作都不会删除提示词正文。</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn" onClick={() => setDropChoice(null)}>取消</button>
              <button type="button" className="btn" onClick={() => resolveDropChoice('child')}>设为子标签</button>
              <button type="button" className="btn-gold" onClick={() => resolveDropChoice('merge')}>合并标签</button>
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
        {offline
          ? '未连接同步服务，已使用本机本地数据'
          : '已开启局域网实时同步（服务端共享存储），离线时回退本机缓存'}
      </div>
    </aside>
  )
}
