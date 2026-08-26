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
    // 合并保存：保留 confirmDelete / theme 即时设置项
    onSave({ ...settings, thinkingSummaryPrompt: trimmed })
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
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* P0-4 删除前二次确认（onChange 即存） */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm text-paper">删除前二次确认</p>
              <p className="mt-0.5 text-xs text-muted">
                关闭后从卡片上直接点删除将不再弹窗确认（更快，但删除不可撤销）
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.confirmDelete}
              aria-label="删除前二次确认"
              onClick={() => onSave({ ...settings, confirmDelete: !settings.confirmDelete })}
              className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                settings.confirmDelete ? 'bg-gold' : 'bg-ink-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                  settings.confirmDelete ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          {/* P0-5 外观主题（onChange 即存，system 跟随系统偏好） */}
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <label htmlFor="settings-theme" className="text-sm text-paper">
              外观主题
            </label>
            <p className="mt-0.5 text-xs text-muted">跟随系统偏好，或手动固定为暗色 / 亮色</p>
            <select
              id="settings-theme"
              className="field mt-2"
              value={settings.theme}
              onChange={(e) => onSave({ ...settings, theme: e.target.value as Settings['theme'] })}
            >
              <option value="system">跟随系统</option>
              <option value="dark">暗色</option>
              <option value="light">亮色</option>
            </select>
          </div>
          {/* P0-5 主题提示：当前生效主题（仅提示，不改设置） */}
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <label htmlFor="settings-prompt" className="text-xs text-muted">
              思维方式总结提示词模板
            </label>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              留空则使用内置默认模板；模板必须包含 {'{body}'} 占位符（会被替换为提示词正文）。
            </p>
            <textarea
              id="settings-prompt"
              className="field mt-2 min-h-48 resize-y font-mono text-xs leading-relaxed"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError(null)
              }}
              placeholder={DEFAULT_THINKING_PROMPT}
              aria-invalid={error ? true : undefined}
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-rust">
                {error}
              </p>
            )}
            <button type="button" className="btn mt-2" onClick={() => setText(DEFAULT_THINKING_PROMPT)}>
              恢复默认模板
            </button>
          </div>
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