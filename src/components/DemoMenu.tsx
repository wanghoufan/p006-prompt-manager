'use client'

import { useEffect, useRef, useState } from 'react'

export type ViewMode = 'mine' | 'demo'

interface DemoMenuProps {
  view: ViewMode
  repoCount: number
  demoCount: number
  onSwitchView: (view: ViewMode) => void
  onLoadDemo: () => void
  onClearRepo: () => void
}

function MenuRow({
  label,
  right,
  active,
  danger,
  onClick,
}: {
  label: string
  right?: string
  active?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
        active
          ? 'bg-gold/10 text-gold-bright'
          : danger
            ? 'text-rust hover:bg-rust/10'
            : 'text-paper-dim hover:bg-ink-800 hover:text-paper'
      }`}
    >
      <span>{label}</span>
      {right && <span className={`shrink-0 font-mono text-xs ${active ? 'text-gold' : 'text-muted'}`}>{right}</span>}
    </button>
  )
}

export function DemoMenu({ view, repoCount, demoCount, onSwitchView, onLoadDemo, onClearRepo }: DemoMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`btn ${view === 'demo' ? 'border-gold/50 text-gold-bright' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        示例
        <span aria-hidden className="text-[10px] text-muted">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-line bg-ink-850 p-2 shadow-xl shadow-black/50">
          <p className="px-2.5 pb-1 pt-1 text-[11px] tracking-wider text-muted">浏览</p>
          <MenuRow
            label="我的仓库"
            right={String(repoCount)}
            active={view === 'mine'}
            onClick={() => {
              onSwitchView('mine')
              setOpen(false)
            }}
          />
          <MenuRow
            label="示例知识库"
            right={String(demoCount)}
            active={view === 'demo'}
            onClick={() => {
              onSwitchView('demo')
              setOpen(false)
            }}
          />
          <div className="my-1.5 h-px bg-line" />
          <p className="px-2.5 pb-1 text-[11px] tracking-wider text-muted">操作</p>
          <MenuRow
            label="载入示例到我的仓库"
            onClick={() => {
              onLoadDemo()
              setOpen(false)
            }}
          />
          <MenuRow
            label="清空我的仓库"
            danger
            onClick={() => {
              onClearRepo()
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}