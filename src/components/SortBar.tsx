'use client'

import type { SortMode } from '@/lib/types'

interface SortBarProps {
  mode: SortMode
  onChange: (mode: SortMode) => void
  count: number
  scopeLabel: string
}

const OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'updated', label: '默认' },
  { value: 'copies', label: '复制次数' },
  { value: 'rating', label: '评分' },
]

export function SortBar({ mode, onChange, count, scopeLabel }: SortBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-900 p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors ${
              mode === o.value ? 'bg-gold/15 text-gold-bright' : 'text-muted hover:text-paper'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-[11px] text-muted md:block">选中卡片后按 1~5 打星，按 0 清除</span>
        <span className="text-xs text-muted">
          {scopeLabel} · <span className="font-mono">{count}</span> 张
        </span>
      </div>
    </div>
  )
}