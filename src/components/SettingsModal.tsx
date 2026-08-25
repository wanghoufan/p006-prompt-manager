'use client'

import { useRef, useState } from 'react'
import type { Settings } from '@/lib/types'
import { DEFAULT_THINKING_PROMPT } from '@/lib/prompts'
import { useModalFocus } from '@/hooks/useModalFocus'

interface SettingsModalProps {
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [text, setText] = useState(settings.thinkingSummaryPrompt)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // OPT-NEW-2：复用 CardDetail 的 useModalFocus（打开聚焦 / Tab 循环 / 关闭归还 / Esc 关闭）
  useModalFocus(panelRef, true, onClose)

  function handleSave() {
    const trimmed = text.trim()
    if (trimmed && !trimmed.includes('{body}')) {
      setError('模板中需要包含 {body} 占位符，否则正文不会被注入')
      return
    }
    onSave({ thinkingSummaryPrompt: trimmed })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-ink-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="font-serif text-sm text-paper">设置</span>
          <button type="button" className="btn-ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          <label htmlFor="settings-prompt" className="text-xs text-muted">
            思维方式总结提示词模板
          </label>
          <p className="text-xs leading-relaxed text-muted">
            留空则使用内置默认模板；模板必须包含 {'{body}'} 占位符（会被替换为提示词正文）。
          </p>
          <textarea
            id="settings-prompt"
            className="field mt-1 min-h-48 resize-y font-mono text-xs leading-relaxed"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            placeholder={DEFAULT_THINKING_PROMPT}
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p role="alert" className="text-xs text-rust">
              {error}
            </p>
          )}
          <button type="button" className="btn" onClick={() => setText(DEFAULT_THINKING_PROMPT)}>
            恢复默认模板
          </button>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-gold" onClick={handleSave}>
            保存设置
          </button>
        </footer>
      </div>
    </div>
  )
}