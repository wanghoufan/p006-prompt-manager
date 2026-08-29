import { AiError, BaseAIAdapter } from './adapter'
import type { AIConfig, ChatMessage, ChatOptions } from './types'

export const GOOGLE_DEFAULT_MODEL = 'gemini-2.0-flash'
export const GOOGLE_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'

interface GeminiContent {
  role: 'user' | 'model'
  parts: { text: string }[]
}

/** 把通用消息映射为 Gemini 格式：system → systemInstruction，assistant → model，
 *  合并连续同角色消息（Gemini 要求 user/model 交替）。 */
function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const out: GeminiContent[] = []
  for (const m of messages) {
    if (m.role === 'system') continue
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user'
    const last = out[out.length - 1]
    if (last && last.role === role) {
      last.parts.push({ text: m.content })
    } else {
      out.push({ role, parts: [{ text: m.content }] })
    }
  }
  return out
}

/** Google Gemini：REST generateContent，key 走查询参数 ?key=，请求/响应结构与 OpenAI 兼容不同。 */
export class GoogleAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || GOOGLE_DEFAULT_MODEL,
      baseUrl: config.baseUrl || GOOGLE_DEFAULT_BASE_URL,
    })
  }

  protected get endpoint(): string {
    return `${this.baseUrl}/v1beta/models/${this.model}:generateContent`
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const { apiKey } = this
    if (!apiKey || apiKey.startsWith('sk-your-key')) {
      throw new AiError('AI 服务尚未配置，请在 .env.local 中设置 API Key 后重启服务', 503)
    }
    const systemInstruction = messages.find((m) => m.role === 'system')?.content
    const res = await fetch(`${this.endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        contents: toGeminiContents(messages),
        ...(options.temperature !== undefined || options.maxTokens !== undefined
          ? {
              generationConfig: {
                ...(options.temperature !== undefined
                  ? { temperature: options.temperature }
                  : {}),
                ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
              },
            }
          : {}),
      }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        const body = (await res.json()) as { error?: { message?: string } }
        detail = body.error?.message ?? ''
      } catch {
        // ignore
      }
      throw new AiError(`Google 接口返回错误（${res.status}）：${detail}`)
    }
    const data: unknown = await res.json()
    const parts =
      (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })?.['candidates']?.[0]
        ?.content?.parts ?? []
    const text = parts
      .map((p) => p.text)
      .filter((t): t is string => typeof t === 'string')
      .join('')
    if (!text.trim()) {
      throw new AiError('Google 返回内容为空')
    }
    return text
  }
}