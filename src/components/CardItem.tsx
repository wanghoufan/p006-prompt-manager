'use client'

import type { ReactNode } from 'react'
import type { Card } from '@/lib/types'
import { Stars } from '@/components/Stars'

interface CardItemProps {
  card: Card
  selected: boolean
  readonly?: boolean
  /** 全局搜索词：命中片段用 <mark> 高亮（纯文本拆分渲染，防 XSS） */
  query?: string
  onSelect: () => void
  onOpen: () => void
  onCopy: () => void
  onRate: (rating: number) => void
  /** P0-4 网格直删：readonly/demo 视图不传（不显示删除按钮） */
  onDelete?: (id: string) => void
  /** P2-11 批量多选：readonly/demo 视图不传（不显示多选框） */
  bulkSelected?: boolean
  bulkActive?: boolean
  onBulkToggle?: (id: string) => void
  /** 设置开启时才使用浏览器原生 title 展示正文全文。 */
  hoverPreview?: boolean
  /** 卡片标签的展示串（完整路径 父/子）；不传则回退显示 card.tags */
  tagLabels?: string[]
}

/** 把文本按关键词拆分为片段数组：非命中片段为纯文本节点，命中片段包 <mark>。
 *  全程只渲染文本节点，绝不使用 dangerouslySetInnerHTML，天然免疫 XSS。
 *  高亮样式集中在 globals.css 的 mark 规则（--color-highlight* 四变量，P0-6 双主题高对比）。 */
function highlightParts(text: string, query: string): ReactNode[] {
  if (!query) return [text]
  const q = query.toLowerCase()
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let i = 0
  let idx = lower.indexOf(q, i)
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(<mark key={idx}>{text.slice(idx, idx + q.length)}</mark>)
    i = idx + q.length
    idx = lower.indexOf(q, i)
  }
  if (i < text.length) parts.push(text.slice(i))
  return parts
}

export function CardItem({ card, selected, readonly = false, query = '', onSelect, onOpen, onCopy, onRate, onDelete, bulkSelected = false, bulkActive = false, onBulkToggle, hoverPreview = false, tagLabels }: CardItemProps) {
  // @code 直达模式：高亮词去掉 @ 前缀，命中片段落在调取码徽标上
  const match = query.replace(/^@/, '').trim()
  return (
    <article
      onClick={bulkActive ? (e) => { e.stopPropagation(); onBulkToggle?.(card.id) } : onSelect}
      onDoubleClick={onOpen}
      className={`group relative flex cursor-pointer flex-col gap-2.5 rounded-lg border p-3.5 transition-colors ${
        selected ? 'border-gold/60 bg-ink-850' : 'border-line bg-ink-900 hover:border-ink-700'
      }`}
      title={readonly ? '双击查看详情（只读）' : undefined}
    >
      {/* P0-7 标题行右侧预留胶囊位（pr-16），操作胶囊悬浮时不再挤压标题/正文 */}
      <div className="flex items-start justify-between gap-2 pr-16">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-paper" title={card.title}>
          {highlightParts(card.title, match)}
        </h3>
        {card.code && (
          <span
            className="shrink-0 font-mono text-[10px] text-gold-bright"
            title={`调取码：${card.code}`}
          >
            @{highlightParts(card.code, match)}
          </span>
        )}
        {readonly && (
          <span className="shrink-0 rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-bright">
            示例
          </span>
        )}
      </div>
      {/* P0-7 操作列悬浮胶囊：absolute 不占文档流，group-hover / 批量激活时显隐，回收中间空白 */}
      {!readonly && (
        <div
          className={`absolute right-2 top-2 z-10 flex flex-col items-end gap-0.5 rounded-md border border-line/70 bg-ink-900/80 p-1 shadow-lg backdrop-blur-sm transition-opacity ${
            bulkActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          }`}
        >
          {onBulkToggle && (
            <button
              type="button"
              role="checkbox"
              aria-checked={bulkSelected}
              title={bulkSelected ? '取消多选' : '加入多选'}
              className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] leading-none transition-opacity ${
                bulkSelected
                  ? 'border-gold bg-gold text-ink-950'
                  : 'border-ink-700 bg-ink-900 text-transparent hover:border-gold/60'
              } ${bulkSelected || bulkActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={(e) => {
                e.stopPropagation()
                onBulkToggle(card.id)
              }}
            >
              ✓
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
          >
            编辑
          </button>
          {onDelete && (
            <button
              type="button"
              className="btn-ghost text-rust hover:bg-rust/10"
              title="删除卡片"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(card.id)
              }}
            >
              删除
            </button>
          )}
        </div>
      )}
      {card.body && (
        <p
          className="line-clamp-3 min-w-0 whitespace-pre-wrap text-xs leading-relaxed text-paper-dim/80"
          title={hoverPreview ? card.body : undefined}
        >
          {highlightParts(card.body, match)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {(tagLabels ?? card.tags).map((t) => (
          <span
            key={t}
            className="rounded-full border border-gold/25 bg-gold/5 px-2 py-0.5 text-[11px] text-gold-bright"
          >
            {highlightParts(t, match)}
          </span>
        ))}
        {card.tags.length === 0 && (
          <span className="text-[11px] text-muted">未打标签</span>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between pt-0.5">
        <Stars rating={card.rating} onChange={readonly ? undefined : onRate} />
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-muted">
            {card.copyCount} <span className="text-[10px]">次复制</span>
          </span>
          {readonly ? (
            <span className="rounded-md border border-line bg-ink-850 px-2.5 py-1 text-xs text-muted">
              只读
            </span>
          ) : (
            <button
              type="button"
              className="btn-gold px-2.5 py-1 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onCopy()
              }}
            >
              复制
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
