import { AiError, BaseAIAdapter } from './adapter'
import type { AIConfig, ChatMessage, ChatOptions } from './types'

export const OPENCODE_DEFAULT_BASE_URL = (
  process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1'
).replace(/\/+$/, '')

export const OPENCODE_GO_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'

const OPENCODE_REQUEST_TIMEOUT_MS = 30_000

type EndpointType = 'responses' | 'messages' | 'chat' | 'google'

export const FREE_ENDPOINTS: Record<string, Extract<EndpointType, 'responses' | 'chat'>> = {
  'muse-spark-1.2-contributor-free': 'responses',
  'hy3-free': 'chat',
  'ling-3.0-flash-fin-free': 'chat',
  'nemotron-3.5-lightning-free': 'chat',
}

export const GO_ENDPOINTS: Record<string, Extract<EndpointType, 'responses' | 'messages' | 'chat'>> = {
  'grok-4.6': 'responses',
  'gpt-5.6-luna': 'responses',
  'muse-spark-1.2-contributor': 'responses',
  'minimax-m3': 'messages',
  'minimax-m2.7': 'messages',
  'minimax-m2.5': 'messages',
  'qwen3.8-max': 'messages',
  'qwen3.8-flash': 'messages',
  'qwen3.7-max': 'messages',
  'qwen3.7-plus': 'messages',
  'qwen3.6-plus': 'messages',
  'glm-5.3-flash': 'chat',
  'glm-5.3': 'chat',
  'glm-5.2': 'chat',
  'glm-5.1': 'chat',
  'kimi-k3': 'chat',
  'kimi-k2.7-code': 'chat',
  'kimi-k2.6': 'chat',
  'longcat-2.0': 'chat',
  'deepseek-v4-pro': 'chat',
  'deepseek-v4-flash': 'chat',
  'deepseek-v4-flash-vision-exp': 'chat',
  'mimo-v2.5': 'chat',
  'mimo-v2.5-pro': 'chat',
  'hy4-preview': 'chat',
  'hy3': 'chat',
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
            max_output_tokens: options.maxTokens ?? 1024,
          }
        : endpointType === 'messages'
          ? {
              model: this.model,
              max_tokens: options.maxTokens ?? 1024,
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
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new AiError(`OpenCode 接口返回错误（${res.status}）：${(await res.text()).slice(0, 200)}`)
      }

      const data: unknown = await res.json()
      const content =
        endpointType === 'responses'
          ? getResponsesContent(data)
          : endpointType === 'messages'
            ? (data as { content?: { text?: unknown }[] }).content?.[0]?.text
            : endpointType === 'google'
              ? (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] }).candidates?.[0]
                  ?.content?.parts?.[0]?.text
              : getChatContent(data)

      if (typeof content !== 'string' || !content.trim()) {
        throw new AiError('OpenCode 返回内容为空')
      }
      return content
    } catch (error) {
      if (error instanceof AiError) throw error
      if (controller.signal.aborted) {
        throw new AiError('OpenCode 请求超时（30 秒），请稍后重试或更换模型', 504)
      }
      if (error instanceof SyntaxError) {
        throw new AiError('OpenCode 返回了无法解析的响应')
      }
      throw new AiError(`无法连接 OpenCode Zen（${this.baseUrl}）`, 503)
    } finally {
      clearTimeout(timeout)
    }
  }
}
