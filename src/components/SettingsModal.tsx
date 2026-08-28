'use client'

import { useRef, useState } from 'react'
import type { Settings } from '@/lib/types'
import { DEFAULT_THINKING_PROMPT } from '@/lib/prompts'
import { useModalFocus } from '@/hooks/useModalFocus'

const MCP_PROJECT_ROOT = '/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0'

type McpScenario = {
  id: 'gpt' | 'workbuddy' | 'orca'
  name: string
  buildCommand: string
  agentPrompt: string
}

const MCP_SCENARIOS: McpScenario[] = [
  {
    id: 'gpt',
    name: 'GPT',
    buildCommand: `cd "${MCP_PROJECT_ROOT}/mcp/prompt-server" && npm install && npm run build`,
    agentPrompt: `请为我连接本地 Prompt Manager MCP。请直接完成下面工作；任何一步不满足时，说明准确原因和下一步，不要猜测配置路径或覆盖已有 MCP。

1. 环境检测：确认当前机器有 Node.js（执行 node --version），并定位提示词管理器项目根目录。优先使用：${MCP_PROJECT_ROOT}；若路径不存在，查找包含 mcp/prompt-server/package.json 的项目目录。
2. 构建：进入 <项目根>/mcp/prompt-server，执行 npm install 和 npm run build；确认 dist/index.js 已生成。解析 command -v node，后续配置必须使用该绝对路径。
3. GPT 配置检测：先识别我当前所说的 GPT 客户端及其本地 MCP 接入方式。若是 Codex，检查其现有 MCP 配置（优先 ~/.codex/config.toml）；若是 ChatGPT 桌面版，先检查应用内或本机已有的 MCP 配置入口。仅在确认该客户端支持本地 stdio MCP 后再写入配置。
4. 配置写入：保留原有服务器，新增或更新唯一的 prompt-manager 条目。command 使用上一步得到的 Node 绝对路径，args 为 ["<项目根>/mcp/prompt-server/dist/index.js"]，description 为“本地提示词管理库：通过调取码激活卡片为系统提示词”。写入后校验配置格式。
5. 完成后告诉我：已写入的配置位置、实际项目路径、是否构建成功；然后提示我完全新开一个 GPT 会话，使 MCP 工具重新加载。

连接后，我会用“调取 <调取码>”调用 prompt_manager_activate_prompt。`,
  },
  {
    id: 'workbuddy',
    name: 'WorkBuddy',
    buildCommand: `cd "${MCP_PROJECT_ROOT}/mcp/prompt-server" && npm install && npm run build`,
    agentPrompt: `请为我连接本地 Prompt Manager MCP。请直接完成下面工作；任何一步不满足时，说明准确原因和下一步，不要猜测路径或覆盖已有 MCP。

1. 环境检测：确认 Node.js 可用（node --version），并定位项目根目录。优先使用：${MCP_PROJECT_ROOT}；若路径不存在，查找包含 mcp/prompt-server/package.json 的项目目录。
2. 构建：进入 <项目根>/mcp/prompt-server，执行 npm install 和 npm run build；确认 dist/index.js 已生成。解析 command -v node，后续配置必须使用该绝对路径。
3. 配置检测：确认 WorkBuddy 配置文件为 ~/.workbuddy/mcp.json（不带点；不要写 ~/.workbuddy/.mcp.json）。若文件已存在，先读取并保留其他 mcpServers。
4. 配置写入：在 mcpServers 中新增或更新 prompt-manager：command 为 Node 的绝对路径，args 为 ["<项目根>/mcp/prompt-server/dist/index.js"]，description 为“本地提示词管理库：通过调取码激活卡片为系统提示词”。写入后校验 JSON 格式；如 WorkBuddy 要求在连接器界面确认，请完成保存和信任。
5. 完成后告诉我实际项目路径、配置文件路径和构建结果，然后提示我完全新开一个 WorkBuddy 会话，使 MCP 工具重新加载。

连接后，我会用“调取 <调取码>”调用 prompt_manager_activate_prompt。`,
  },
  {
    id: 'orca',
    name: 'Orca',
    buildCommand: `cd "${MCP_PROJECT_ROOT}/mcp/prompt-server" && npm install && npm run build`,
    agentPrompt: `请为我连接本地 Prompt Manager MCP。请直接完成下面工作；任何一步不满足时，说明准确原因和下一步，不要猜测配置路径或覆盖已有 MCP。

1. 环境检测：确认 Node.js 可用（node --version），并定位项目根目录。优先使用：${MCP_PROJECT_ROOT}；若路径不存在，查找包含 mcp/prompt-server/package.json 的项目目录。
2. 构建：进入 <项目根>/mcp/prompt-server，执行 npm install 和 npm run build；确认 dist/index.js 已生成。解析 command -v node，后续配置必须使用该绝对路径。
3. Orca 配置检测：执行 orca --help，并查询 MCP 相关帮助或读取当前 Orca 的 MCP 配置；确认该安装版本使用的配置命令/文件和现有格式。不要凭空创建不被当前版本识别的配置文件。
4. 配置写入：按当前 Orca 版本实际支持的方式，保留已有 MCP 服务器并新增或更新唯一的 prompt-manager 条目。command 使用 Node 的绝对路径，args 为 ["<项目根>/mcp/prompt-server/dist/index.js"]，description 为“本地提示词管理库：通过调取码激活卡片为系统提示词”。写入后执行该版本可用的配置校验或列表命令。
5. 完成后告诉我实际项目路径、配置位置/执行命令和构建结果，然后提示我完全新开一个 Orca 会话，使 MCP 工具重新加载。

连接后，我会用“调取 <调取码>”调用 prompt_manager_activate_prompt。`,
  },
]

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
          <details className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <summary className="cursor-pointer text-sm text-paper">MCP 一键连接提示词</summary>
            <div className="mt-3 space-y-4 text-xs leading-relaxed text-muted">
              <p>选择正在使用的客户端。先复制构建命令，或直接复制完整提示词交给对应 AI 代理执行；配置完成后必须新开会话。</p>
              {MCP_SCENARIOS.map((scenario) => (
                <section key={scenario.id} className="rounded-md border border-line bg-ink-850 p-3">
                  <h3 className="text-sm font-medium text-paper">{scenario.name}</h3>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-paper-dim">1. 构建命令</p>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 text-xs"
                      onClick={() => void copyMcpText(`${scenario.id}-command`, scenario.buildCommand)}
                    >
                      {copied === `${scenario.id}-command` ? '已复制' : '复制命令'}
                    </button>
                  </div>
                  <pre className="mt-1 overflow-x-auto rounded-md bg-ink-900 p-2 font-mono text-[10px] text-paper-dim">{scenario.buildCommand}</pre>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-paper-dim">2. 交给 AI 代理执行</p>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 text-xs"
                      onClick={() => void copyMcpText(`${scenario.id}-prompt`, scenario.agentPrompt)}
                    >
                      {copied === `${scenario.id}-prompt` ? '已复制' : '复制完整提示词'}
                    </button>
                  </div>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-ink-900 p-2 font-mono text-[10px] text-paper-dim">{scenario.agentPrompt}</pre>
                </section>
              ))}
              <p aria-live="polite" className={copied === 'error' ? 'text-rust' : 'text-muted'}>
                {copied === 'error' ? '复制失败，请检查浏览器剪贴板权限后重试。' : '连接后可说“调取 &lt;调取码&gt;”触发 prompt_manager_activate_prompt。'}
              </p>
            </div>
          </details>
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
