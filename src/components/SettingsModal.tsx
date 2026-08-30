'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Settings } from '@/lib/types'
import type { AIProvider } from '@/lib/ai/types'
import { AiError } from '@/lib/ai/adapter'
import { DEFAULT_THINKING_PROMPT } from '@/lib/prompts'
import { useModalFocus } from '@/hooks/useModalFocus'
import { maskApiKey } from '@/lib/util'

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

const CONNECTION_TEST_TIMEOUT_MS = 35_000

/**
 * 通用AI接口的服务商注册表（Phase 2）。
 * 模型列表固定在客户端；仅 OpenRouter 支持自定义模型名称。
 */
const AI_SERVICES: {
  provider: AIProvider
  label: string
  available: boolean
  models: string[]
  defaultBaseUrl: string
  docsUrl: string
}[] = [
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    available: true,
    models: ['deepseek-v4-pro', 'deepseek-v4-flash-vision-exp', 'deepseek-v4-flash'],
    defaultBaseUrl: 'https://api.deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com/zh-cn/',
  },
  {
    provider: 'zhipu',
    label: '智谱（GLM）',
    available: true,
    models: [
      'glm-5.3', 'glm-5.3-flash', 'glm-5.2',
      'glm-4.7', 'glm-4.7-flashx', 'glm-4.6', 'glm-4.5-air', 'glm-4.5-airx',
      'glm-4-long', 'glm-4-flashx-250414', 'glm-4-flash-250414', 'glm-3-turbo',
    ],
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    docsUrl: 'https://docs.bigmodel.cn/cn/guide/start/model-overview',
  },
  {
    provider: 'tencent',
    label: '腾讯混元',
    available: true,
    models: ['hunyuan-pro', 'hunyuan-standard', 'hunyuan-lite'],
    defaultBaseUrl: 'https://hunyuan.cloud.tencent.com',
    docsUrl: 'https://cloud.tencent.com/document/product/1729/101837',
  },
  {
    provider: 'doubao',
    label: '豆包（火山引擎）',
    available: true,
    models: [
      'doubao-seed-2-1-pro-260628', 'doubao-seed-evolving', 'doubao-seed-2-1-turbo-260628',
      'doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-code-preview-260215',
      'doubao-seed-2-0-lite-260215', 'doubao-seed-2-0-mini-260215',
    ],
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    docsUrl: 'https://www.volcengine.com/docs/82379/1330310',
  },
  {
    provider: 'kimi',
    label: 'Kimi（月之暗面）',
    available: true,
    models: [
      'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6', 'kimi-k2.5',
      'moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k',
    ],
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    docsUrl: 'https://platform.kimi.com/docs/models',
  },
  {
    provider: 'google',
    label: 'Google Gemini',
    available: true,
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    available: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultBaseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    available: true,
    models: ['auto'],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/docs',
  },
  {
    provider: 'opencode',
    label: 'OpenCode（免费）',
    available: true,
    models: [
      'big-pickle', 'mimo-v2.5-free', 'hy3-free', 'ling-3.0-flash-fin-free',
      'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free', 'muse-spark-1.2-contributor-free',
    ],
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    docsUrl: 'https://opencode.ai/auth',
  },
  {
    provider: 'opencode-go',
    label: 'OpenCode Go（$10/月）',
    available: true,
    models: [
      'grok-4.6', 'gpt-5.6-luna', 'muse-spark-1.2-contributor', 'minimax-m3', 'minimax-m2.7',
      'minimax-m2.5', 'qwen3.8-max', 'qwen3.8-flash', 'qwen3.7-max', 'qwen3.7-plus',
      'qwen3.6-plus', 'glm-5.3-flash', 'glm-5.3', 'glm-5.2', 'glm-5.1', 'kimi-k3',
      'glm-5', 'kimi-k2.7-code', 'kimi-k2.6', 'kimi-k2.5', 'longcat-2.0', 'deepseek-v4-pro',
      'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'mimo-v2.5', 'mimo-v2.5-pro',
      'hy4-preview', 'hy3',
    ],
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    docsUrl: 'https://opencode.ai/go',
  },
]

interface SettingsModalProps {
  settings: Settings
  onSave: Dispatch<SetStateAction<Settings>>
  onClose: () => void
  /** P1-AI4：AI 配置保存后的反馈提示（复用页面 Toast） */
  onNotify?: (msg: string) => void
}

export function SettingsModal({ settings, onSave, onClose, onNotify }: SettingsModalProps) {
  const [text, setText] = useState(settings.thinkingSummaryPrompt)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // P1-AI1：API Key 输入框草稿（不直接回显明文，仅在 placeholder 展示脱敏值）
  const [keyDraft, setKeyDraft] = useState('')
  const [connectionTest, setConnectionTest] = useState<{ success: boolean; message: string } | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  // P1-AI4：AI 配置即存，防抖后 toast 反馈
  const aiSaveTimer = useRef<number | null>(null)
  const aiService = AI_SERVICES.find((service) => service.provider === settings.aiProvider)
  const aiModels = aiService?.models ?? []
  const isOpenRouter = settings.aiProvider === 'openrouter'
  const isOpenRouterCustomModel = isOpenRouter && settings.aiModel !== 'auto'

  // OPT-NEW-2：复用 CardDetail 的 useModalFocus（打开聚焦 / Tab 循环 / 关闭归还 / Esc 关闭）
  useModalFocus(panelRef, true, onClose)

  useEffect(() => {
    return () => {
      if (aiSaveTimer.current) window.clearTimeout(aiSaveTimer.current)
    }
  }, [])

  /** P1-AI4：AI 配置 onChange 即存，防抖提示「AI配置已保存」 */
  function saveAi(patch: Partial<Settings>) {
    setConnectionTest(null)
    // 设置控件可能连续触发更新；从最新状态合并，避免陈旧渲染快照把刚选的
    // 服务商或模型覆盖回之前的值。
    onSave((current) => {
      const next = { ...current, ...patch }
      console.log('[AI settings] SettingsModal onChange', {
        previousProvider: current.aiProvider,
        patchProvider: patch.aiProvider,
        nextProvider: next.aiProvider,
        nextModel: next.aiModel,
      })
      return next
    })
    if (aiSaveTimer.current) window.clearTimeout(aiSaveTimer.current)
    aiSaveTimer.current = window.setTimeout(() => onNotify?.('AI配置已保存'), 800)
  }

  async function testConnection() {
    setIsTestingConnection(true)
    setConnectionTest(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT_MS)
    const baseUrl = settings.aiBaseUrl || aiService?.defaultBaseUrl || ''
    const apiKey = keyDraft || settings.aiApiKey
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-ai-provider': settings.aiProvider,
      'x-ai-model': settings.aiModel,
      'x-ai-base-url': baseUrl,
    }
    if (apiKey) headers['x-ai-api-key'] = apiKey

    try {
      const res = await fetch('/api/ai/summarize-thinking', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          body: '连接测试',
          prompt: '请仅回复“连接成功”。内容：{body}',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: unknown }
      if (!res.ok) {
        throw new AiError(typeof data.error === 'string' ? data.error : `请求失败（${res.status}）`, res.status)
      }
      setConnectionTest({ success: true, message: '连接成功' })
    } catch (e) {
      const reason = controller.signal.aborted
        ? '连接测试超时（35 秒），请稍后重试或更换模型'
        : e instanceof Error
          ? e.message
          : '未知错误'
      setConnectionTest({
        success: false,
        message: e instanceof AiError ? e.message : `连接失败：${reason}`,
      })
    } finally {
      window.clearTimeout(timeout)
      setIsTestingConnection(false)
    }
  }

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
          {/* 通用AI接口（Phase 2）：服务商 / 模型 / Base URL / API Key（onChange 即存） */}
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <p className="text-sm text-paper">AI 服务</p>
            <p className="mt-0.5 text-xs text-muted">
              用于标题标签生成、正文整理与思考摘要。切换服务商自动切换到默认模型。
            </p>
            <label htmlFor="settings-ai-provider" className="mt-3 block text-xs text-muted">
              服务商
            </label>
            <select
              id="settings-ai-provider"
              className="field mt-1"
              value={settings.aiProvider}
              onChange={(e) => {
                const provider = e.target.value as AIProvider
                const service = AI_SERVICES.find((s) => s.provider === provider)
                saveAi({
                  aiProvider: provider,
                  aiModel: service?.models[0] ?? '',
                  aiBaseUrl: service?.defaultBaseUrl ?? '',
                })
              }}
            >
              {AI_SERVICES.map((s) => (
                <option key={s.provider} value={s.provider} disabled={!s.available}>
                  {s.available ? s.label : `${s.label}（即将支持）`}
                </option>
              ))}
            </select>
            <label htmlFor="settings-ai-model" className="mt-3 block text-xs text-muted">
              模型
            </label>
            {isOpenRouter ? (
              <>
                <select
                  id="settings-ai-model"
                  className="field mt-1"
                  value={isOpenRouterCustomModel ? 'custom' : 'auto'}
                  onChange={(e) => saveAi({ aiModel: e.target.value === 'auto' ? 'auto' : '' })}
                >
                  <option value="auto">auto</option>
                  <option value="custom">自定义模型</option>
                </select>
                {isOpenRouterCustomModel && (
                  <input
                    id="settings-ai-model-custom"
                    className="field mt-2"
                    value={settings.aiModel}
                    onChange={(e) => saveAi({ aiModel: e.target.value })}
                    placeholder="输入 OpenRouter 模型名称"
                    autoComplete="off"
                  />
                )}
              </>
            ) : (
              <select
                id="settings-ai-model"
                className="field mt-1"
                value={aiModels.includes(settings.aiModel) ? settings.aiModel : aiModels[0] ?? ''}
                onChange={(e) => saveAi({ aiModel: e.target.value })}
              >
                {aiModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}
            {settings.aiProvider === 'opencode' && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                <a
                  href="https://opencode.ai/docs/zh-cn/zen"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold underline underline-offset-2 hover:text-paper"
                >
                  查看当前可用的免费模型
                </a>
              </p>
            )}
            <label htmlFor="settings-ai-base-url" className="mt-3 block text-xs text-muted">
              Base URL（可选，留空使用默认）
            </label>
            <input
              id="settings-ai-base-url"
              type="text"
              className="field mt-1"
              value={settings.aiBaseUrl}
              onChange={(e) => saveAi({ aiBaseUrl: e.target.value })}
              placeholder={aiService?.defaultBaseUrl ?? 'https://…'}
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Base URL 是服务商 API 的基础地址。留空使用默认地址，或填写自定义地址。{' '}
              {aiService && (
                <a
                  href={aiService.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold underline underline-offset-2 hover:text-paper"
                >
                  查看 {aiService.label} API 文档
                </a>
              )}
            </p>
            <label htmlFor="settings-ai-api-key" className="mt-3 block text-xs text-muted">
              API Key
            </label>
            {/* P1-AI1：Key 不回显明文。已有 Key 时 placeholder 展示脱敏值（前4后4），聚焦留空输入即替换；留空表示用服务端环境变量 */}
            <input
              id="settings-ai-api-key"
              type="password"
              className="field mt-1"
              value={keyDraft}
              onChange={(e) => {
                setKeyDraft(e.target.value)
                saveAi({ aiApiKey: e.target.value })
              }}
              placeholder={settings.aiApiKey ? maskApiKey(settings.aiApiKey) : '留空则使用服务端环境变量'}
              autoComplete="new-password"
            />
            {settings.aiApiKey && (
              <p className="mt-1.5 text-xs text-muted">
                已保存 Key：{maskApiKey(settings.aiApiKey)}（仅保存在本机浏览器，不同步到服务端；点击输入框输入新 Key 可替换）
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-muted">
              本机填写的 API Key 仅保存在浏览器本地，不会上传到同步服务端；留空时自动回退到服务端{' '}
              <code className="font-mono">.env.local</code> 环境变量。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-gold"
                onClick={() => void testConnection()}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? '正在测试连接…' : '测试连接'}
              </button>
              {connectionTest && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`text-xs ${connectionTest.success ? 'text-gold' : 'text-rust'}`}
                >
                  {connectionTest.message}
                </p>
              )}
            </div>
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
