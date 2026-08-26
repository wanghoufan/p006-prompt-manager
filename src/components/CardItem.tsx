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
}

/** 把文本按关键词拆分为片段数组：非命中片段为纯文本节点，命中片段包 <mark>。
 *  全程只渲染文本节点，绝不使用 dangerouslySetInnerHTML，天然免疫 XSS。
 *  高亮样式走 CSS 变量 --color-highlight / --color-highlight-text（P0-5 双主题自适应）。 */
function highlightParts(text: string, query: string): ReactNode[] {
  if (!query) return [text]
  const q = query.toLowerCase()
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let i = 0
  let idx = lower.indexOf(q, i)
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark key={idx} className="rounded-[2px] bg-highlight text-highlight ring-1 ring-highlight-ring">
        {text.slice(idx, idx + q.length)}
      </mark>,
    )
    i = idx + q.length
    idx = lower.indexOf(q, i)
  }
  if (i < text.length) parts.push(text.slice(i))
  return parts
}

export function CardItem({ card, selected, readonly = false, query = '', onSelect, onOpen, onCopy, onRate, onDelete }: CardItemProps) {
  // @code 直达模式：高亮词去掉 @ 前缀，命中片段落在调取码徽标上
  const match = query.replace(/^@/, '').trim()
  return (
    <article
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={`group relative flex cursor-pointer flex-col gap-2.5 rounded-lg border p-3.5 transition-colors ${
        selected ? 'border-gold/60 bg-ink-850' : 'border-line bg-ink-900 hover:border-ink-700'
      }`}
      title={readonly ? '双击查看详情（只读）' : undefined}
    >
      <div className="flex items-start justify-between gap-2">
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
        {!readonly && (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <button
              type="button"
              className="btn-ghost opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
                className="btn-ghost text-rust opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-rust/10"
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
      </div>
      {card.body && (
        <p
          className="line-clamp-2 min-w-0 whitespace-pre-wrap text-xs leading-relaxed text-paper-dim/80"
          title={card.body}
        >
          {highlightParts(card.body, match)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {card.tags.map((t) => (
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