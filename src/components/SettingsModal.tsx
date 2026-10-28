'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Settings } from '@/lib/types'
import { AI_MODEL_PRESETS, type AIProvider } from '@/lib/ai/types'
import { AiError } from '@/lib/ai/adapter'
import { aiListModels, aiTestConnection, resolveClientAiConfig } from '@/lib/ai/client'
import { DEFAULT_THINKING_PROMPT } from '@/lib/prompts'
import { useModalFocus } from '@/hooks/useModalFocus'
import { maskApiKey } from '@/lib/util'
import { McpCloudAccess } from '@/components/McpCloudAccess'
import { IS_STATIC_TRIAL } from '@/lib/trial'

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

const CONNECTION_TEST_HINT = '连接测试会真实调用一次上游，最多等 100 秒（推理模型首字较慢）'

/**
 * 通用AI接口的服务商注册表。
 * DeepSeek 是预置项（默认 V4.1：model id `deepseek-flash`，base https://api.deepseek.com）；
 * 其余厂商走 custom —— 任意 OpenAI 兼容端点，只需 baseURL + apiKey + model。
 * 注意：custom 只支持浏览器直连（见 lib/ai/client.ts），静态试用版正是这种模式。
 */
const AI_SERVICES: {
  provider: AIProvider
  label: string
  available: boolean
  models: readonly string[]
  defaultBaseUrl: string
  docsUrl: string
}[] = [
  {
    provider: 'deepseek',
    label: 'DeepSeek（预置 · V4.1）',
    available: true,
    models: AI_MODEL_PRESETS.deepseek,
    defaultBaseUrl: 'https://api.deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com/zh-cn/',
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    available: true,
    models: AI_MODEL_PRESETS.openrouter,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/docs',
  },
  {
    provider: 'opencode',
    label: 'OpenCode Zen',
    available: true,
    models: AI_MODEL_PRESETS.opencode,
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    docsUrl: 'https://opencode.ai/docs/zh-cn/zen',
  },
  {
    provider: 'opencode-go',
    label: 'OpenCode Go（$10/月）',
    available: true,
    models: AI_MODEL_PRESETS['opencode-go'],
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    docsUrl: 'https://opencode.ai/docs/zh-cn/go',
  },
  {
    provider: 'custom',
    label: '自定义（任意 OpenAI 兼容端点）',
    available: true,
    models: AI_MODEL_PRESETS.custom,
    defaultBaseUrl: '',
    docsUrl: '',
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
  const [showKey, setShowKey] = useState(false)
  const [connectionTest, setConnectionTest] = useState<{ success: boolean; message: string } | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  // 「拉取模型列表」：成功后填进 datalist 供选，失败复用 connectionTest 的位置报错
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  // P1-AI4：AI 配置即存，防抖后 toast 反馈
  const aiSaveTimer = useRef<number | null>(null)
  const templateSaveTimer = useRef<number | null>(null)
  const aiService = AI_SERVICES.find((service) => service.provider === settings.aiProvider)
  const aiModels = fetchedModels.length > 0 ? fetchedModels : (aiService?.models ?? [])

  // OPT-NEW-2：复用 CardDetail 的 useModalFocus（打开聚焦 / Tab 循环 / 关闭归还 / Esc 关闭）
  useModalFocus(panelRef, true, onClose)

  useEffect(() => {
    return () => {
      if (aiSaveTimer.current) window.clearTimeout(aiSaveTimer.current)
      if (templateSaveTimer.current) window.clearTimeout(templateSaveTimer.current)
    }
  }, [])

  /** 思维模板与其他设置一样即存（防抖 800ms）；校验失败不落库、只提示。 */
  function handleTemplateChange(value: string) {
    setText(value)
    const trimmed = value.trim()
    if (trimmed && !trimmed.includes('{body}')) {
      setError('模板中需要包含 {body} 占位符，否则正文不会被注入（此项未保存）')
      return
    }
    setError(null)
    if (templateSaveTimer.current) window.clearTimeout(templateSaveTimer.current)
    templateSaveTimer.current = window.setTimeout(() => {
      onSave((current) => ({ ...current, thinkingSummaryPrompt: trimmed }))
    }, 800)
  }

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

  /** 面板上「此刻正在编辑」的配置：测试连接/拉模型用它，避免读到上一次落盘的旧值。 */
  function currentConfig() {
    const resolved = resolveClientAiConfig(settings)
    return {
      provider: settings.aiProvider,
      model: settings.aiModel,
      baseUrl: settings.aiBaseUrl || resolved.baseUrl,
      apiKey: keyDraft || settings.aiApiKey,
    }
  }

  async function testConnection() {
    setIsTestingConnection(true)
    setConnectionTest(null)
    try {
      const message = await aiTestConnection(currentConfig())
      setConnectionTest({ success: true, message })
    } catch (e) {
      setConnectionTest({
        success: false,
        message: e instanceof AiError ? e.message : `连接失败：${e instanceof Error ? e.message : '未知错误'}`,
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  async function fetchModels() {
    setIsFetchingModels(true)
    setConnectionTest(null)
    try {
      const models = await aiListModels(currentConfig())
      setFetchedModels(models)
      setConnectionTest({
        success: true,
        message: `已拉取 ${models.length} 个模型，点「模型」输入框可下拉选择`,
      })
    } catch (e) {
      setConnectionTest({
        success: false,
        message: e instanceof AiError ? e.message : `拉取失败：${e instanceof Error ? e.message : '未知错误'}`,
      })
    } finally {
      setIsFetchingModels(false)
    }
  }

  // 所有设置均已即存；「完成」仅关闭弹窗。模板校验失败时不落库（上方有红字提示），关闭即放弃该草稿。
  function handleDone() {
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
          {IS_STATIC_TRIAL && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 px-3.5 py-3 text-xs leading-relaxed text-muted">
              网页试用版：数据与 API Key 都只保存在当前浏览器（localStorage），不会上传任何服务器。AI
              由浏览器直连你自己填的服务商，不预置也不内置任何 Key；云同步与 MCP 接入需要本地服务端，
              试用版未启用。换浏览器或清缓存后 Key 需要重填，数据可用顶栏「导出」备份。
            </div>
          )}
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
            <p className="mt-0.5 text-xs text-muted">跟随系统偏好，或手动固定一套主题；顶栏胶囊可快速切换</p>
            <select
              id="settings-theme"
              className="field mt-2"
              value={settings.theme}
              onChange={(e) => onSave({ ...settings, theme: e.target.value as Settings['theme'] })}
            >
              <option value="system">跟随系统</option>
              <option value="light">亮色 · 暖纸墨</option>
              <option value="dark">墨色 · 皮革账本</option>
              <option value="phosphor">夜航磷青（暗）</option>
              <option value="blueprint">工程蓝图（暗）</option>
            </select>
          </div>
          {!IS_STATIC_TRIAL && <McpCloudAccess />}
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
          {/* AI 与 MCP 都需要本地服务端，网页试用版整体隐藏 */}
          {/* AI 服务：试用版也可见。静态站走浏览器直连用户自备 Key（见 lib/ai/client.ts） */}
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <p className="text-sm text-paper">AI 服务</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              用于生成标题标签、AI 整理思考与正文格式化。不预置任何 Key：用你自己的账号，Key
              只存在本浏览器 localStorage，不上传服务器，换浏览器或清缓存就没了。
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
                // 仅在未自定义（为空或仍是旧服务商默认地址）时跟随切换默认值，
                // 用户手填的自定义 Base URL（如自建网关）予以保留，不再静默清空。
                const prevDefault = aiService?.defaultBaseUrl ?? ''
                const keepCustom = settings.aiBaseUrl !== '' && settings.aiBaseUrl !== prevDefault
                setFetchedModels([])
                saveAi({
                  aiProvider: provider,
                  // DeepSeek 预置 V4.1（deepseek-flash）；custom 没有预置模型，留空由用户填写
                  aiModel: service?.models[0] ?? '',
                  aiBaseUrl: keepCustom ? settings.aiBaseUrl : (service?.defaultBaseUrl ?? ''),
                })
              }}
            >
              {AI_SERVICES.map((s) => (
                <option key={s.provider} value={s.provider} disabled={!s.available}>
                  {s.available ? s.label : `${s.label}（即将支持）`}
                </option>
              ))}
            </select>
            <label htmlFor="settings-ai-base-url" className="mt-3 block text-xs text-muted">
              请求地址（Base URL）
            </label>
            <input
              id="settings-ai-base-url"
              type="text"
              className="field mt-1"
              value={settings.aiBaseUrl}
              onChange={(e) => saveAi({ aiBaseUrl: e.target.value })}
              placeholder={aiService?.defaultBaseUrl || 'https://你的端点/v1'}
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              填 OpenAI 兼容端点即可。DeepSeek 填 <code className="font-mono">https://api.deepseek.com</code>
              ，带不带 <code className="font-mono">/v1</code> 都行（浏览器直连时会自动补全路径）。
              {aiService?.docsUrl && (
                <>
                  {' '}
                  <a
                    href={aiService.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gold underline underline-offset-2 hover:text-paper"
                  >
                    查看 API 文档
                  </a>
                </>
              )}
            </p>
            <label htmlFor="settings-ai-api-key" className="mt-3 block text-xs text-muted">
              API Key
            </label>
            {/* P1-AI1：Key 不回显明文。已有 Key 时 placeholder 展示脱敏值（前4后4），聚焦留空输入即替换 */}
            <div className="relative mt-1">
              <input
                id="settings-ai-api-key"
                type={showKey ? 'text' : 'password'}
                className="field pr-14"
                value={keyDraft}
                onChange={(e) => {
                  setKeyDraft(e.target.value)
                  saveAi({ aiApiKey: e.target.value })
                }}
                placeholder={
                  settings.aiApiKey
                    ? maskApiKey(settings.aiApiKey)
                    : IS_STATIC_TRIAL
                      ? '粘贴你自己的 API Key'
                      : '留空则使用服务端环境变量'
                }
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-muted transition-colors hover:text-paper"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
                aria-pressed={showKey}
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
            {settings.aiApiKey && (
              <p className="mt-1.5 text-xs text-muted">
                已保存 Key：{maskApiKey(settings.aiApiKey)}（只存在本浏览器，不上传服务器；输入新 Key 可替换）
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Key 只写入本机浏览器 localStorage，不进入同步快照、不写服务端；换浏览器或清缓存后需要重填。
              {!IS_STATIC_TRIAL && '留空时回退服务端 .env.local，但仅当该变量所属厂商与所选服务商一致。'}
            </p>
            <label htmlFor="settings-ai-model" className="mt-3 block text-xs text-muted">
              模型
            </label>
            <input
              id="settings-ai-model"
              className="field mt-1"
              list="settings-ai-model-presets"
              value={settings.aiModel}
              onChange={(e) => saveAi({ aiModel: e.target.value })}
              placeholder={aiModels[0] ?? '输入模型名称，如 deepseek-flash'}
              autoComplete="off"
            />
            <datalist id="settings-ai-model-presets">
              {aiModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              模型名可自由输入。DeepSeek 预置 <code className="font-mono">deepseek-flash</code>（V4.1）；
              也可点「拉取模型列表」从服务商读回可用模型。
            </p>
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => void fetchModels()}
                disabled={isFetchingModels}
              >
                {isFetchingModels ? '正在拉取…' : '拉取模型列表'}
              </button>
              <button
                type="button"
                className="btn-gold"
                onClick={() => void testConnection()}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? '正在测试连接…' : '测试连接'}
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{CONNECTION_TEST_HINT}</p>
            {connectionTest && (
              <p
                role="status"
                aria-live="polite"
                className={`mt-2 text-xs leading-relaxed ${connectionTest.success ? 'text-gold' : 'text-rust'}`}
              >
                {connectionTest.message}
              </p>
            )}
          </div>
          {!IS_STATIC_TRIAL && (
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <p className="text-sm text-paper">一键接入 MCP 客户端</p>
            <p className="mt-0.5 text-xs text-muted">
              先在上方为本机生成令牌并保存 `.env.local`，再把下面这句话发给你的 AI；它会自动完成安装、配置和协议验证。
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
                  脚本会自动装依赖、构建、找出你本装的 AI 客户端并逐个配好，最后验证 MCP 协议。调取时直接访问云端，不依赖本机提示词文件。
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
          )}
          {/* P0-5 主题提示：当前生效主题（仅提示，不改设置） */}
          <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
            <label htmlFor="settings-prompt" className="text-xs text-muted">
              思维方式总结提示词模板
            </label>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              留空则使用内置默认模板；模板必须包含 {'{body}'} 占位符（会被替换为提示词正文）。修改后自动保存。
            </p>
            <textarea
              id="settings-prompt"
              className="field mt-2 min-h-48 resize-y font-mono text-xs leading-relaxed"
              value={text}
              onChange={(e) => handleTemplateChange(e.target.value)}
              placeholder={DEFAULT_THINKING_PROMPT}
              aria-invalid={error ? true : undefined}
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-rust">
                {error}
              </p>
            )}
            <button type="button" className="btn mt-2" onClick={() => handleTemplateChange(DEFAULT_THINKING_PROMPT)}>
              恢复默认模板
            </button>
          </div>
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <p className="text-xs text-muted">所有设置更改后立即自动保存</p>
          <button type="button" className="btn-gold" onClick={handleDone}>
            完成
          </button>
        </footer>
      </div>
    </div>
  )
}
