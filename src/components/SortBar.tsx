'use client'

import type { SortMode } from '@/lib/types'

interface SortBarProps {
  mode: SortMode
  onChange: (mode: SortMode) => void
  count: number
  scopeLabel: string
}

const OPTIONS: { value: SortMode; label: string; hint: string }[] = [
  { value: 'updated', label: '最近更新', hint: '按最后修改时间排序（最新在前）' },
  { value: 'copies', label: '复制次数', hint: '按被复制 / 调取的次数排序（高频在前）' },
  { value: 'rating', label: '评分', hint: '按星级评分排序（高分在前）' },
]

export function SortBar({ mode, onChange, count, scopeLabel }: SortBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted" title="选择排序方式后，下方卡片会立即重新排序">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M5 8h6M7.5 12h1" strokeLinecap="round" />
          </svg>
          排序方式
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-900 p-0.5">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              title={o.hint}
              aria-pressed={mode === o.value}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors ${
                mode === o.value ? 'bg-gold/15 text-gold-bright' : 'text-muted hover:text-paper'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
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