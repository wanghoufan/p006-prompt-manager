'use client'

import { useRef } from 'react'
import { DemoMenu, type ViewMode } from '@/components/DemoMenu'

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
}: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readOnly = view === 'demo'

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-line bg-ink-950 px-5 py-3">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-lg tracking-wide text-paper">提示词管理</h1>
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.25em] text-muted sm:block">
          Prompt Ledger
        </span>
      </div>
      <div className="flex items-center gap-2">
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
          title={readOnly ? '示例知识库为只读' : '导入备份'}
        >
          导入
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = ''
          }}
        />
        <button type="button" className="btn" onClick={onOpenSettings}>
          设置
        </button>
      </div>
    </header>
  )
}