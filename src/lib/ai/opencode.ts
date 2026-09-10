import { randomUUID } from 'node:crypto'

import { AiError, BaseAIAdapter } from './adapter'
import type { AIConfig, ChatMessage, ChatOptions } from './types'

export const OPENCODE_DEFAULT_BASE_URL = (
  process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1'
).replace(/\/+$/, '')

export const OPENCODE_GO_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'

const OPENCODE_REQUEST_TIMEOUT_MS = 90_000

/** OpenCode Go 网关要求客户端提供「稳定会话标识 + 自有 User-Agent」，否则返回
 *  400 MissingSessionID（鉴权之后的路由校验）。此处取进程级稳定 ID：同一实例内所有
 *  请求复用，便于上游路由与 prompt 缓存；容器/进程重启后重新生成。
 *  需要跨重启保持同一标识时，用 OPENCODE_SESSION_ID 环境变量固定。 */
const OPENCODE_SESSION_ID =
  (process.env.OPENCODE_SESSION_ID ?? '').trim() || `prompt-manager-${randomUUID()}`

const OPENCODE_USER_AGENT = 'prompt-manager/1.0'

type EndpointType = 'responses' | 'messages' | 'chat' | 'google'

/** Zen 免费端点。2026-09-10 按 GET /zen/v1/models 实测目录校准：
 *  big-pickle / mimo-v2.5-free / hy3-free / nemotron-3-ultra-free 已下线（上游报 disabled），
 *  deepseek-v4-flash-free 与 muse-spark-1.3-contributor-free 为新上架条目。 */
export const FREE_ENDPOINTS: Record<string, Extract<EndpointType, 'responses' | 'chat'>> = {
  'muse-spark-1.3-contributor-free': 'responses',
  'muse-spark-1.2-contributor-free': 'responses',
  'deepseek-v4-flash-free': 'chat',
  'ling-3.0-flash-fin-free': 'chat',
  'nemotron-3.5-lightning-free': 'chat',
}

/** Go 端点。2026-09-10 按 GET /zen/go/v1/models 实测目录逐条校准（36 条 = 目录全集），
 *  端点类型取自官方文档表格；文档未列出的模型按同族推断：grok 系与 muse-spark 系走 responses，
 *  qwen 系与 minimax 系走 messages，其余走 chat。 */
export const GO_ENDPOINTS: Record<string, Extract<EndpointType, 'responses' | 'messages' | 'chat'>> = {
  'grok-4.6': 'responses',
  'grok-4.5': 'responses',
  'gpt-5.6-luna': 'responses',
  'muse-spark-1.3-contributor': 'responses',
  'muse-spark-1.2-contributor': 'responses',
  'minimax-m3': 'messages',
  'minimax-m2.7': 'messages',
  'minimax-m2.5': 'messages',
  'qwen3.8-max': 'messages',
  'qwen3.8-flash': 'messages',
  'qwen3.7-max': 'messages',
  'qwen3.7-plus': 'messages',
  'qwen3.6-plus': 'messages',
  'qwen3.5-plus': 'messages',
  'glm-5.3-flash': 'chat',
  'glm-5.3': 'chat',
  'glm-5.2': 'chat',
  'glm-5.1': 'chat',
  'glm-5': 'chat',
  'kimi-k3': 'chat',
  'kimi-k2.7-code': 'chat',
  'kimi-k2.6': 'chat',
  'kimi-k2.5': 'chat',
  'longcat-2.0': 'chat',
  'deepseek-v4-pro': 'chat',
  'deepseek-v4-flash': 'chat',
  'deepseek-v4-flash-vision-exp': 'chat',
  'deepseek-flash': 'chat',
  'mimo-v2.5': 'chat',
  'mimo-v2.5-pro': 'chat',
  'mimo-v2-pro': 'chat',
  'mimo-v2-omni': 'chat',
  'hy4-preview': 'chat',
  'hy3': 'chat',
  'hy3-preview': 'chat',
  'omen-alpha': 'chat',
}

export function getEndpointType(model: string, provider: AIConfig['provider']): EndpointType {
  const endpoints = provider === 'opencode-go' ? GO_ENDPOINTS : FREE_ENDPOINTS
  return endpoints[model] ?? 'chat'
}

function getSystemText(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
}

function getGoogleContents(messages: ChatMessage[], system: string) {
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))

  if (!system) return contents

  const firstUser = contents.find((content) => content.role === 'user')
  if (firstUser) {
    firstUser.parts[0].text = `${system}\n\n${firstUser.parts[0].text}`
  } else {
    contents.unshift({ role: 'user', parts: [{ text: system }] })
  }
  return contents
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
    if (value && typeof value === 'object' && 'value' in value) {
      const nested = (value as { value?: unknown }).value
      if (typeof nested === 'string' && nested.trim()) return nested
    }
  }
}

function getResponsesContent(data: unknown): string | undefined {
  const response = data as {
    output_text?: unknown
    reasoning_content?: unknown
    reasoning?: unknown
    output?: {
      type?: string
      text?: unknown
      reasoning_content?: unknown
      reasoning?: unknown
      summary?: { text?: unknown }[]
      content?: {
        type?: string
        text?: unknown
        reasoning_content?: unknown
        reasoning?: unknown
      }[]
    }[]
  }
  const outputs = response.output ?? []
  const parts = outputs.flatMap((output) => output.content ?? [])

  return firstNonEmptyString(
    response.output_text,
    ...outputs.map((output) => output.text),
    ...parts.map((part) => part.text),
    response.reasoning_content,
    response.reasoning,
    ...outputs.flatMap((output) => [output.reasoning_content, output.reasoning]),
    ...parts.flatMap((part) => [part.reasoning_content, part.reasoning]),
    ...outputs.flatMap((output) => output.summary?.map((part) => part.text) ?? []),
  )
}

function getChatContent(data: unknown): string | undefined {
  const message = (data as {
    choices?: { message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown } }[]
  }).choices?.[0]?.message

  return firstNonEmptyString(message?.content, message?.reasoning_content, message?.reasoning)
}

/** Anthropic 风格 /messages 的 content 是块数组：推理模型会先给 thinking 块、再给 text 块，
 *  所以不能只看 content[0]（实测 qwen3.8-max 首个块就是 thinking，会被误判成空响应）。 */
function getMessagesContent(data: unknown): string | undefined {
  const blocks =
    (data as { content?: { type?: unknown; text?: unknown; thinking?: unknown }[] }).content ?? []
  const texts = blocks.filter((block) => block.type === 'text').map((block) => block.text)
  const thinking = blocks.filter((block) => block.type === 'thinking').map((block) => block.thinking)

  return firstNonEmptyString(...texts, ...thinking)
}

function getUpstreamErrorMessage(body: string): string | undefined {
  try {
    const data = JSON.parse(body) as { message?: unknown; error?: unknown }
    const nestedError =
      data.error && typeof data.error === 'object'
        ? (data.error as { message?: unknown }).message
        : data.error
    return firstNonEmptyString(data.message, nestedError)
  } catch {
    return body.trim() || undefined
  }
}

/** OpenCode Zen：按每个模型的明确端点映射构造与解析上游请求。 */
export class OpenCodeAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || '',
      baseUrl:
        config.baseUrl ||
        (config.provider === 'opencode-go' ? OPENCODE_GO_DEFAULT_BASE_URL : OPENCODE_DEFAULT_BASE_URL),
    })
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    if (!this.apiKey || this.apiKey.startsWith('sk-your-key')) {
      throw new AiError('OpenCode Zen 尚未配置 API Key，请到 https://opencode.ai/auth 获取后填写')
    }

    const endpointType = getEndpointType(this.model, this.provider)
    const system = getSystemText(messages)
    const chatMessages = messages.filter((message) => message.role !== 'system')
    const endpoint =
      endpointType === 'responses'
        ? `${this.baseUrl}/responses`
        : endpointType === 'messages'
          ? `${this.baseUrl}/messages`
          : endpointType === 'google'
            ? `${this.baseUrl}/models/${this.model}:generateContent`
            : `${this.baseUrl}/chat/completions`
    const body =
      endpointType === 'responses'
        ? {
            model: this.model,
            input: messages.map((message) => ({ role: message.role, content: message.content })),
            // 4096 而非 1024：推理模型的思考 token 也计入输出上限，1024 常被思考吃满。
            max_output_tokens: options.maxTokens ?? 4096,
          }
        : endpointType === 'messages'
          ? {
              model: this.model,
              max_tokens: options.maxTokens ?? 4096,
              ...(system ? { system } : {}),
              messages: chatMessages.map((message) => ({ role: message.role, content: message.content })),
            }
          : endpointType === 'google'
            ? { contents: getGoogleContents(messages, system) }
            : {
                model: this.model,
                messages,
                temperature: options.temperature ?? 0.5,
                ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
              }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENCODE_REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          // Anthropic 风格的 /messages 只认 x-api-key，用 Bearer 会被判「Missing API key」（实测 2026-09-10）。
          ...(endpointType === 'messages'
            ? { 'x-api-key': this.apiKey }
            : { Authorization: `Bearer ${this.apiKey}` }),
          'Content-Type': 'application/json',
          'User-Agent': OPENCODE_USER_AGENT,
          'x-opencode-session': OPENCODE_SESSION_ID,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!res.ok) {
        const upstreamMessage = getUpstreamErrorMessage((await res.text()).slice(0, 2_000))
        if (/model is disabled/i.test(upstreamMessage ?? '')) {
          throw new AiError(`模型 ${this.model} 已被禁用，请更换其他模型`, res.status)
        }
        if (res.status === 401 || res.status === 403) {
          throw new AiError('API Key 无效，请检查后重试', res.status)
        }
        throw new AiError(
          `OpenCode 接口返回错误（${res.status}）：${upstreamMessage ?? '未提供错误信息'}`,
          res.status,
        )
      }

      const data: unknown = await res.json()
      const content =
        endpointType === 'responses'
          ? getResponsesContent(data)
          : endpointType === 'messages'
            ? getMessagesContent(data)
            : endpointType === 'google'
              ? (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] }).candidates?.[0]
                  ?.content?.parts?.[0]?.text
              : getChatContent(data)

      if (typeof content !== 'string' || !content.trim()) {
        throw new AiError(
          'OpenCode 返回内容为空（推理模型思考常占满输出上限，可重试或更换模型）',
        )
      }
      return content
    } catch (error) {
      if (error instanceof AiError) throw error
      if (controller.signal.aborted) {
        throw new AiError(
          `OpenCode 请求超时（${Math.round(OPENCODE_REQUEST_TIMEOUT_MS / 1000)} 秒），请稍后重试或更换模型`,
          504,
        )
      }
      if (error instanceof SyntaxError) {
        throw new AiError('OpenCode 返回了无法解析的响应')
      }
      throw new AiError(`无法连接到 ${this.baseUrl}，请检查网络`, 503)
    } finally {
      clearTimeout(timeout)
    }
  }
}
