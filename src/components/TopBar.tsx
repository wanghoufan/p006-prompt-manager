'use client'

import { useRef } from 'react'
import { DemoMenu, type ViewMode } from '@/components/DemoMenu'
import { SupabaseAuthControl } from '@/components/SupabaseAuthControl'
import type { Settings } from '@/lib/types'

/** 2026-10-11 顶栏主题速切（截图参考样式：胶囊分段）；「跟随系统」留在设置弹窗，速切即固定主题 */
const THEME_OPTIONS: { value: Exclude<Settings['theme'], 'system'>; label: string; title: string }[] = [
  { value: 'dark', label: '暗色', title: '暗色 · 皮革账本' },
  { value: 'light', label: '亮色', title: '亮色 · 暖纸墨' },
  { value: 'cinnabar', label: '印谱', title: '朱砂印谱（亮）' },
  { value: 'phosphor', label: '磷青', title: '夜航磷青（暗）' },
  { value: 'blueprint', label: '蓝图', title: '工程蓝图（暗）' },
]

interface TopBarProps {
  view: ViewMode
  repoCount: number
  demoCount: number
  onSwitchView: (view: ViewMode) => void
  onLoadDemo: () => void
  onClearRepo: () => void
  onExport: () => void
  onImportFile: (file: File) => void
  onOpenSettings: () => void
  onOpenTrash: () => void
  trashCount: number
  theme: Settings['theme']
  onThemeChange: (theme: Settings['theme']) => void
}

export function TopBar({
  view,
  repoCount,
  demoCount,
  onSwitchView,
  onLoadDemo,
  onClearRepo,
  onExport,
  onImportFile,
  onOpenSettings,
  onOpenTrash,
  trashCount,
  theme,
  onThemeChange,
}: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readOnly = view === 'demo'

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-ink-950 px-5 py-3">
      <div className="flex items-baseline gap-3">
        <h1 className="whitespace-nowrap font-serif text-lg tracking-wide text-paper">提示词管理</h1>
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.25em] text-muted sm:block">
          Prompt Ledger
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* 主题速切：system 态不高亮任何段（提示由设置弹窗开启跟随系统） */}
        <div
          role="radiogroup"
          aria-label="外观主题"
          className="hidden items-center gap-0.5 rounded-full border border-line bg-ink-900 p-0.5 md:flex"
        >
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={theme === opt.value}
              title={opt.title}
              onClick={() => onThemeChange(opt.value)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                theme === opt.value
                  ? 'bg-gold/15 font-medium text-gold-bright shadow-[inset_0_0_0_1px_var(--color-gold)]'
                  : 'text-muted hover:text-paper'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <DemoMenu
          view={view}
          repoCount={repoCount}
          demoCount={demoCount}
          onSwitchView={onSwitchView}
          onLoadDemo={onLoadDemo}
          onClearRepo={onClearRepo}
        />
        <button
          type="button"
          className="btn disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onExport}
          disabled={readOnly}
          title={readOnly ? '示例知识库为只读' : '导出备份'}
        >
          导出
        </button>
        <button
          type="button"
          className="btn disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => inputRef.current?.click()}
          disabled={readOnly}
          title={readOnly ? '示例知识库为只读' : '导入备份（支持 JSON 与 Markdown）'}
        >
          导入
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.md,application/json,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = ''
          }}
        />
        <SupabaseAuthControl />
        <button
          type="button"
          className="btn"
          onClick={onOpenTrash}
          title="回收站：恢复删除的卡片与标签"
        >
          回收站{trashCount > 0 ? `（${trashCount}）` : ''}
        </button>
        <button type="button" className="btn" onClick={onOpenSettings}>
          设置
        </button>
      </div>
    </header>
  )
}
