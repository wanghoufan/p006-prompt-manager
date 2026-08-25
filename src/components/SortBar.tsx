'use client'

import type { SortMode } from '@/lib/types'

interface SortBarProps {
  mode: SortMode
  onChange: (mode: SortMode) => void
  count: number
  /** 搜索基数：视图 + 标签过滤后的卡片数（未应用搜索过滤） */
  total: number
  scopeLabel: string
  search: string
  onSearchChange: (v: string) => void
}

const OPTIONS: { value: SortMode; label: string; hint: string }[] = [
  { value: 'updated', label: '最近更新', hint: '按最后修改时间排序（最新在前）' },
  { value: 'copies', label: '复制次数', hint: '按被复制 / 调取的次数排序（高频在前）' },
  { value: 'rating', label: '评分', hint: '按星级评分排序（高分在前）' },
]

export function SortBar({ mode, onChange, count, total, scopeLabel, search, onSearchChange }: SortBarProps) {
  const searching = search.trim().length > 0
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg
            viewBox="0 0 16 16"
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索标题/正文/标签/备注 · @code 直达"
            aria-label="搜索卡片"
            className="w-44 rounded-md border border-line bg-ink-900 py-1.5 pl-7 pr-6 text-xs text-paper placeholder:text-muted transition-colors focus:border-gold focus:outline-none md:w-60"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="清空搜索"
              title="清空搜索"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded text-muted transition-colors hover:text-paper"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <span className="hidden text-[11px] text-muted md:block">选中卡片后按 1~5 打星，按 0 清除</span>
        {searching ? (
          <span className="text-xs text-muted">
            命中 <span className="font-mono">{count}</span> / 共 <span className="font-mono">{total}</span> 张
          </span>
        ) : (
          <span className="text-xs text-muted">
            {scopeLabel} · <span className="font-mono">{count}</span> 张
          </span>
        )}
      </div>
    </div>
  )
}
