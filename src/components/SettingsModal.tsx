'use client'

import { useRef, useState } from 'react'
import type { Settings } from '@/lib/types'
import { DEFAULT_THINKING_PROMPT } from '@/lib/prompts'
import { useModalFocus } from '@/hooks/useModalFocus'

const MCP_PROJECT_ROOT = '/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0'

/**
 * 直接跑这一条就能完成接入：装依赖、构建、写各客户端配置、真调一次验证，全自动。
 */
const SETUP_COMMAND = `node "${MCP_PROJECT_ROOT}/mcp/prompt-server/setup.mjs"`

/**
 * 用户唯一需要复制的东西——一句话，交给 AI 执行。
 */
const SETUP_AGENT_INSTRUCTION = `请执行 ${SETUP_COMMAND} 完成提示词管理器接入，成功后用一句话告诉我怎么用。`

/**
 * 脚本会自动识别并配置这些客户端。仅用于展示，不要求用户理解细节。
 */
const SETUP_CLIENTS = 'WorkBuddy · Codex · Cursor · Claude Desktop · Cline · Windsurf · Gemini CLI'

interface SettingsModalProps {
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [text, setText] = useState(settings.thinkingSummaryPrompt)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
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

  async function copyMcpText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
    } catch {
      setCopied('error')
    }
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
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <label htmlFor="settings-composer-add-mode" className="text-sm text-paper">
              添加模式
            </label>
            <p className="mt-0.5 text-xs text-muted">
              默认直接添加会在粘贴后立即建卡；手动确认则需点击生成按钮或按 Enter。
            </p>
            <select
              id="settings-composer-add-mode"
              className="field mt-2"
              value={settings.composerAddMode}
              onChange={(e) => onSave({ ...settings, composerAddMode: e.target.value as Settings['composerAddMode'] })}
            >
              <option value="auto">默认直接添加</option>
              <option value="manual">手动确认</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm text-paper">鼠标停留预览</p>
              <p className="mt-0.5 text-xs text-muted">开启后，鼠标停留在卡片正文上会显示全文预览。</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.hoverPreview}
              aria-label="鼠标停留预览"
              onClick={() => onSave({ ...settings, hoverPreview: !settings.hoverPreview })}
              className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                settings.hoverPreview ? 'bg-gold' : 'bg-ink-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                  settings.hoverPreview ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-paper">粘贴后自动整理正文</p>
                <p className="mt-0.5 text-xs text-muted">开启后，粘贴到正文区域的内容会按所选对齐方式由 AI 整理。</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoFormatBody}
                aria-label="粘贴后自动整理正文"
                onClick={() => onSave({ ...settings, autoFormatBody: !settings.autoFormatBody })}
                className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  settings.autoFormatBody ? 'bg-gold' : 'bg-ink-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                    settings.autoFormatBody ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <label htmlFor="settings-body-alignment" className="mt-3 block text-sm text-paper">
              正文对齐方式
            </label>
            <select
              id="settings-body-alignment"
              className="field mt-2"
              value={settings.bodyAlignment}
              onChange={(e) => onSave({ ...settings, bodyAlignment: e.target.value as Settings['bodyAlignment'] })}
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </div>
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <p className="text-sm text-paper">一键接入</p>
            <p className="mt-0.5 text-xs text-muted">
              把下面这句话发给你的 AI，它会自动完成安装、配置和验证。你不需要看任何技术细节。
            </p>
            <button
              type="button"
              className="btn-gold mt-3 w-full"
              onClick={() => void copyMcpText('agent', SETUP_AGENT_INSTRUCTION)}
            >
              {copied === 'agent' ? '已复制，去粘贴给 AI ✓' : '复制这句话，发给你的 AI'}
            </button>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-ink-850 p-2 font-mono text-[10px] leading-relaxed text-paper-dim">
              {SETUP_AGENT_INSTRUCTION}
            </pre>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted">想自己跑，或想看它做了什么</summary>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-paper-dim">直接执行的命令</p>
                  <button
                    type="button"
                    className="btn-ghost shrink-0 text-xs"
                    onClick={() => void copyMcpText('command', SETUP_COMMAND)}
                  >
                    {copied === 'command' ? '已复制' : '复制命令'}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-ink-850 p-2 font-mono text-[10px] text-paper-dim">
                  {SETUP_COMMAND}
                </pre>
                <p className="text-xs leading-relaxed text-muted">
                  脚本会自动装依赖、构建、找出你本装的 AI 客户端并逐个配好，最后真调一次验证。它只读提示词库，不会改动任何卡片、标签或调取码。
                </p>
                <p className="text-xs leading-relaxed text-muted">已支持：{SETUP_CLIENTS}</p>
                <p className="text-xs leading-relaxed text-muted">
                  可选：<code className="font-mono">--check</code> 只体检、不改任何东西；<code className="font-mono">--remove</code> 卸载。
                </p>
              </div>
            </details>
            <p
              aria-live="polite"
              className={`mt-2 text-xs ${copied === 'error' ? 'text-rust' : 'text-muted'}`}
            >
              {copied === 'error'
                ? '复制失败，请检查浏览器剪贴板权限后重试。'
                : '接入完成后，对 AI 说「调取 <调取码>」即可加载对应卡片。'}
            </p>
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
