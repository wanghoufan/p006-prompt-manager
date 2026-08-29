import type { AIAdapter, AIConfig, AIProvider, ChatMessage, ChatOptions } from './types'

export class AiError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
  }
}

export type { AIAdapter } from './types'

const PROVIDER_LABELS: Record<AIProvider, string> = {
  deepseek: 'DeepSeek',
  zhipu: '智谱',
  tencent: '腾讯',
  doubao: '豆包',
  kimi: 'Kimi',
  google: 'Google',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
}

export abstract class BaseAIAdapter implements AIAdapter {
  protected readonly provider: AIProvider
  protected readonly model: string
  protected readonly apiKey: string
  protected readonly baseUrl: string

  constructor(config: AIConfig) {
    this.provider = config.provider
    this.model = config.model
    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl || '').replace(/\/+$/, '')
  }

  protected get endpoint(): string {
    return `${this.baseUrl}/chat/completions`
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const { apiKey } = this
    if (!apiKey || apiKey.startsWith('sk-your-key')) {
      throw new AiError('AI 服务尚未配置，请在 .env.local 中设置 API Key 后重启服务', 503)
    }
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.5,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 200)
      } catch {
        // ignore
      }
      throw new AiError(`${PROVIDER_LABELS[this.provider]} 接口返回错误（${res.status}）：${detail}`)
    }
    const data: unknown = await res.json()
    const content =
      (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
        ?.content ?? ''
    if (typeof content !== 'string' || !content.trim()) {
      throw new AiError(`${PROVIDER_LABELS[this.provider]} 返回内容为空`)
    }
    return content
  }
}