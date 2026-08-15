'use client'

import type { Card } from '@/lib/types'
import { Stars } from '@/components/Stars'

interface CardItemProps {
  card: Card
  selected: boolean
  readonly?: boolean
  onSelect: () => void
  onOpen: () => void
  onCopy: () => void
  onRate: (rating: number) => void
}

export function CardItem({ card, selected, readonly = false, onSelect, onOpen, onCopy, onRate }: CardItemProps) {
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
          {card.title}
        </h3>
        {readonly && (
          <span className="shrink-0 rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-bright">
            示例
          </span>
        )}
        {!readonly && (
          <button
            type="button"
            className="btn-ghost shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
          >
            编辑
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {card.tags.map((t) => (
          <span
            key={t}
            className="rounded-full border border-gold/25 bg-gold/5 px-2 py-0.5 text-[11px] text-gold-bright"
          >
            {t}
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