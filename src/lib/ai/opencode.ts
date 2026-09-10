import { randomUUID } from 'node:crypto'

import { AiError, BaseAIAdapter, PROVIDER_LABELS, describeUpstreamError } from './adapter'
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

/** Zen 免费版端点。2026-09-10 收敛为 1 条：glm-5.3-flash（付费模型，Zen 账户需有余额）。
 *  实测被移除的条目：deepseek-v4-flash-free 恒 400「Model is unavailable」、
 *  nemotron-3.5-lightning-free 上游无响应（240s 仍挂）、其余 free 条目不在精简口径内。 */
export const FREE_ENDPOINTS: Record<string, Extract<EndpointType, 'responses' | 'chat'>> = {
  'glm-5.3-flash': 'chat',
}

/** Go 端点。2026-09-10 收敛为 2 条，均实测 200 可用（此前 36 条的清单维护成本过高）。 */
export const GO_ENDPOINTS: Record<string, Extract<EndpointType, 'responses' | 'messages' | 'chat'>> = {
  'deepseek-v4-flash': 'chat',
  'glm-5.3-flash': 'chat',
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

interface UpstreamError {
  type?: string
  message?: string
}

function getUpstreamError(body: string): UpstreamError {
  try {
    const data = JSON.parse(body) as { message?: unknown; error?: unknown }
    const error = data.error
    if (error && typeof error === 'object') {
      const nested = error as { type?: unknown; message?: unknown }
      return {
        type: typeof nested.type === 'string' ? nested.type : undefined,
        message: firstNonEmptyString(nested.message, data.message),
      }
    }
    return {
      message: firstNonEmptyString(data.message, typeof error === 'string' ? error : undefined),
    }
  } catch {
    return { message: body.trim() || undefined }
  }
}

/** 上游的错误分类不能只看状态码：实测（2026-09-10）「模型不存在」返回 401 ModelError，
 *  「Key 无效」返回 401 AuthError，「Zen 余额不足」也是 401 —— 三者状态码相同。
 *  分类规则统一在 adapter.ts 的 describeUpstreamError（所有适配器共用一份判定顺序）。 */

/** 把 fetch 层失败原因附到提示后。undici 常把真实原因放在 cause 里，而 Next.js 日志只记
 *  状态码、不记堆栈 —— 实测 2026-09-10 有一次 10.6s 后 503（上游瞬时断连），只靠日志无法定位。 */
function describeFetchFailure(error: unknown): string {
  if (!(error instanceof Error)) return ''
  const cause = error.cause
  const causeText =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
  const text = causeText || error.message
  return text ? `（${text.slice(0, 120)}）` : ''
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
      const label = this.provider === 'opencode-go' ? 'OpenCode Go' : 'OpenCode Zen'
      throw new AiError(`${label} 尚未配置 API Key，请到 https://opencode.ai/auth 获取后填写`)
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
        const upstreamError = getUpstreamError((await res.text()).slice(0, 2_000))
        throw describeUpstreamError(PROVIDER_LABELS[this.provider], res.status, this.model, {
          type: upstreamError.type,
          reason: upstreamError.message ?? '',
        })
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
      throw new AiError(
        `无法连接到 ${this.baseUrl}${describeFetchFailure(error)}，请检查网络后重试`,
        503,
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}
