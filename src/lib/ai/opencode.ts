import { AiError, BaseAIAdapter } from './adapter'
import type { AIConfig, ChatMessage, ChatOptions } from './types'

export const OPENCODE_DEFAULT_BASE_URL = (
  process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1'
).replace(/\/+$/, '')

type OpenCodeApiFormat = 'anthropic' | 'google' | 'openai'

function getApiFormat(model: string): OpenCodeApiFormat {
  const normalizedModel = model.toLowerCase()
  if (normalizedModel.startsWith('claude') || normalizedModel.startsWith('qwen')) return 'anthropic'
  if (normalizedModel.startsWith('gemini')) return 'google'
  return 'openai'
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

/** OpenCode Zen：通过托管云端网关调用模型，根据模型系列适配三种上游 API 格式。 */
export class OpenCodeAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || '',
      baseUrl: config.baseUrl || OPENCODE_DEFAULT_BASE_URL,
    })
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    if (!this.apiKey || this.apiKey.startsWith('sk-your-key')) {
      throw new AiError('OpenCode Zen 尚未配置 API Key，请到 https://opencode.ai/auth 获取后填写')
    }

    const format = getApiFormat(this.model)
    const system = getSystemText(messages)
    const chatMessages = messages.filter((message) => message.role !== 'system')
    const endpoint =
      format === 'anthropic'
        ? `${this.baseUrl}/messages`
        : format === 'google'
          ? `${this.baseUrl}/models/${this.model}:generateContent`
          : `${this.baseUrl}/chat/completions`
    const body =
      format === 'anthropic'
        ? {
            model: this.model,
            max_tokens: options.maxTokens ?? 1024,
            ...(system ? { system } : {}),
            messages: chatMessages.map((message) => ({ role: message.role, content: message.content })),
          }
        : format === 'google'
          ? { contents: getGoogleContents(messages, system) }
          : {
              model: this.model,
              messages,
              temperature: options.temperature ?? 0.5,
              ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
            }

    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      })
    } catch {
      throw new AiError(`无法连接 OpenCode Zen（${this.baseUrl}）`, 503)
    }

    if (!res.ok) {
      throw new AiError(`OpenCode 接口返回错误（${res.status}）：${(await res.text()).slice(0, 200)}`)
    }

    const data: unknown = await res.json()
    const content =
      format === 'anthropic'
        ? (data as { content?: { text?: unknown }[] }).content?.[0]?.text
        : format === 'google'
          ? (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] }).candidates?.[0]
              ?.content?.parts?.[0]?.text
          : (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content

    if (typeof content !== 'string' || !content.trim()) {
      throw new AiError('OpenCode 返回内容为空')
    }
    return content
  }
}
