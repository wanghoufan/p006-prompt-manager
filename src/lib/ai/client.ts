/**
 * 客户端 AI 路由层：UI 只调这里的函数，不关心请求打到哪。
 *
 * - GitHub Pages 静态试用版（IS_STATIC_TRIAL）：没有 Node 运行时，一律走浏览器直连，
 *   用用户自己填在 localStorage 的 Key（见 lib/ai/browser.ts）。
 * - 自定义服务商（custom）：只走浏览器直连——任意 OpenAI 兼容端点，服务端没有登记。
 * - 本地完整版：保持原样走 `/api/ai/*`，保留 MCP、服务端 .env 兜底等既有行为。
 */
import { AiError } from '@/lib/ai/adapter'
import { browserChat, browserListModels } from '@/lib/ai/browser'
import {
  buildFormatPrompt,
  buildMetaPrompt,
  buildThinkingPrompt,
  FORMAT_MAX_TOKENS,
  parseMetaResult,
  THINKING_MAX_TOKENS,
  type BodyAlignment,
} from '@/lib/ai/meta'
import {
  AI_DEFAULT_BASE_URLS,
  type AIConfig,
  type AIProvider,
  type ChatMessage,
} from '@/lib/ai/types'
import { loadSettings } from '@/lib/storage'
import { IS_STATIC_TRIAL } from '@/lib/trial'
import type { GenerateMetaResult, Settings } from '@/lib/types'

export type AiTransport = 'browser' | 'server'

/** 把设置解析成一次调用可用的配置（baseUrl 留空时补厂商默认值）。 */
export function resolveClientAiConfig(settings?: Settings): AIConfig {
  const s = settings ?? loadSettings()
  const provider = s.aiProvider as AIProvider
  return {
    provider,
    model: s.aiModel,
    apiKey: s.aiApiKey,
    baseUrl: s.aiBaseUrl || AI_DEFAULT_BASE_URLS[provider] || '',
  }
}

/** 当前会走哪条通道。 */
export function aiTransport(settings?: Settings): AiTransport {
  const s = settings ?? loadSettings()
  if (IS_STATIC_TRIAL) return 'browser'
  if (s.aiProvider === 'custom') return 'browser'
  return 'server'
}

/**
 * 是否已经「配好 AI」。
 * 静态站：必须有用户自己的 Key（没有服务端 env 可兜底）。
 * 本地完整版：走 /api/ai/*，Key 可以来自服务端 .env.local，因此选了内置服务商就算可用。
 */
export function isAiConfigured(settings?: Settings): boolean {
  const s = settings ?? loadSettings()
  if (aiTransport(s) === 'browser') {
    return !!s.aiApiKey.trim() && !!s.aiModel.trim()
  }
  return true
}

/** 未配置时给用户的一句引导（按钮不隐藏，点了给这句话）。 */
export const AI_NOT_CONFIGURED_HINT = '先去「设置 → AI 服务」填你自己的 API Key（只存在本机浏览器）'

function notConfiguredError(): AiError {
  return new AiError(AI_NOT_CONFIGURED_HINT, 503)
}

function withDefaults(config: AIConfig): AIConfig {
  return { ...config, baseUrl: config.baseUrl || AI_DEFAULT_BASE_URLS[config.provider] || '' }
}

interface CallOptions {
  signal?: AbortSignal
}

/** 浏览器通道的前置校验：缺 Key / 缺模型时给引导，而不是发一个注定 401 的请求。 */
function browserConfig(settings?: Settings): AIConfig {
  const config = withDefaults(resolveClientAiConfig(settings))
  if (!config.apiKey.trim() || !config.model.trim()) throw notConfiguredError()
  return config
}

function browserChatOrThrow(messages: ChatMessage[], options: Parameters<typeof browserChat>[1], settings?: Settings) {
  return browserChat(messages, options, browserConfig(settings))
}

// ===================== 服务端通道（本地完整版） =====================

interface ApiRequest {
  path: string
  payload: unknown
  signal?: AbortSignal
  /** 设置面板测试连接时用「正在编辑、尚未落盘」的配置覆盖请求头。 */
  headers?: Record<string, string>
}

/** P1-AI1：AI 配置随 /api/ai/* 请求头传递，Key 不进共享存储。 */
function settingsHeaders(): Record<string, string> {
  return configHeaders(resolveClientAiConfig())
}

function configHeaders(config: AIConfig): Record<string, string> {
  const headers: Record<string, string> = {}
  if (config.provider) headers['x-ai-provider'] = config.provider
  if (config.model) headers['x-ai-model'] = config.model
  if (config.baseUrl) headers['x-ai-base-url'] = config.baseUrl
  if (config.apiKey) headers['x-ai-api-key'] = config.apiKey
  return headers
}

async function postApi<T>({ path, payload, signal, headers }: ApiRequest): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...settingsHeaders(), ...headers },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new AiError('请求已取消', 408)
    throw new AiError('无法连接本机 AI 代理服务，请确认本地服务端仍在运行', 0)
  }
  let data: { error?: unknown } & Record<string, unknown>
  try {
    data = (await res.json()) as { error?: unknown } & Record<string, unknown>
  } catch {
    throw new AiError('AI 服务返回了无法识别的响应，请稍后重试', res.status)
  }
  if (!res.ok) {
    const message =
      typeof data.error === 'string' && data.error.trim() ? data.error : `请求失败（HTTP ${res.status}）`
    throw new AiError(message, res.status)
  }
  return data as T
}

// ===================== 对外 API =====================

/** 生成标题 + 标签。 */
export async function aiGenerateMeta(
  body: string,
  existingTags: string[],
  options: CallOptions = {},
): Promise<GenerateMetaResult> {
  if (aiTransport() === 'browser') {
    const content = await browserChatOrThrow(
      [{ role: 'user', content: buildMetaPrompt(body, existingTags) }],
      { signal: options.signal },
    )
    return parseMetaResult(content)
  }
  return postApi<GenerateMetaResult>({
    path: '/api/ai/generate-meta',
    payload: { body, existingTags },
    signal: options.signal,
  })
}

/** 思维总结（AI 整理思考）。 */
export async function aiSummarizeThinking(
  body: string,
  customPrompt: string | null | undefined,
  options: CallOptions = {},
): Promise<string> {
  if (aiTransport() === 'browser') {
    const content = await browserChatOrThrow(
      [{ role: 'user', content: buildThinkingPrompt(body, customPrompt ?? undefined) }],
      { maxTokens: THINKING_MAX_TOKENS, signal: options.signal },
    )
    return content.trim()
  }
  const data = await postApi<{ summary?: string }>({
    path: '/api/ai/summarize-thinking',
    payload: { body, prompt: customPrompt || null },
    signal: options.signal,
  })
  return (data.summary ?? '').trim()
}

/** 正文格式化。 */
export async function aiFormatBody(
  body: string,
  alignment: BodyAlignment,
  options: CallOptions = {},
): Promise<string> {
  if (aiTransport() === 'browser') {
    const content = await browserChatOrThrow(
      [{ role: 'user', content: buildFormatPrompt(body, alignment) }],
      { temperature: 0, maxTokens: FORMAT_MAX_TOKENS, signal: options.signal },
    )
    return content.trim()
  }
  const data = await postApi<{ body?: string }>({
    path: '/api/ai/format-body',
    payload: { body, alignment },
    signal: options.signal,
  })
  return (data.body ?? '').trim()
}

/**
 * 设置面板「测试连接」：发一条极短 chat。
 * 通道仍按 aiTransport 判定；显式传入的 config（面板里可能还没落盘的字段）用于覆盖，
 * 免得测的是上一次保存的旧配置。
 */
export async function aiTestConnection(config?: AIConfig): Promise<string> {
  const resolved = withDefaults(config ?? resolveClientAiConfig())
  if (aiTransport() === 'browser') {
    await browserChat(
      [{ role: 'user', content: '连接测试，请只回复「连接成功」。' }],
      { maxTokens: 32, temperature: 0 },
      resolved,
    )
    return '连接成功'
  }
  await postApi({
    path: '/api/ai/summarize-thinking',
    payload: { body: '连接测试', prompt: '请仅回复“连接成功”。内容：{body}' },
    headers: config ? configHeaders(config) : undefined,
  })
  return '连接成功'
}

/** 设置面板「拉取模型列表」：GET {baseUrl}/models（浏览器直连）。 */
export async function aiListModels(config?: AIConfig): Promise<string[]> {
  return browserListModels(withDefaults(config ?? resolveClientAiConfig()))
}

export type { AIConfig }
