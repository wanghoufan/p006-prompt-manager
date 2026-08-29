import { AiError, BaseAIAdapter } from './adapter'
import type { AIConfig, ChatMessage } from './types'

export const OPENCODE_DEFAULT_BASE_URL = (process.env.OPENCODE_BASE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
)

interface OpenCodeSession {
  id?: string
}

interface OpenCodeTextPart {
  type: 'text'
  text: string
}

interface OpenCodeMessageResponse {
  parts?: unknown[]
}

/** OpenCode：连接本机 opencode 服务（默认 http://localhost:3000，本地 API，无需 API Key）。
 *  API 与 OpenAI 兼容格式不同：先建会话，再发消息，从响应的 parts 中提取文本。 */
export class OpenCodeAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || '',
      baseUrl: config.baseUrl || OPENCODE_DEFAULT_BASE_URL,
    })
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const last = messages[messages.length - 1]
    const history = messages.slice(0, -1).filter((m) => m.role !== 'system')
    const content = [...history.map((m) => `${m.role}:\n${m.content}`), `user:\n${last.content}`].join('\n\n')

    const send = async (path: string, body: unknown) => {
      try {
        return await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {
        throw new AiError(
          `无法连接 OpenCode 本地服务（${this.baseUrl}）：请先启动 OpenCode 并开启服务（opencode serve 或桌面端）`,
          503,
        )
      }
    }

    const sessionRes = await send('/session', {})
    if (!sessionRes.ok) {
      throw new AiError(
        `OpenCode 创建会话失败（${sessionRes.status}）：${(await sessionRes.text()).slice(0, 200)}`,
      )
    }
    const session = (await sessionRes.json()) as OpenCodeSession
    if (!session?.id) {
      throw new AiError('OpenCode 返回的会话无效')
    }

    const messageRes = await send(`/session/${session.id}/message`, {
      ...(this.model ? { model: this.model } : {}),
      ...(system ? { system } : {}),
      parts: [{ type: 'text', text: content }],
    })
    if (!messageRes.ok) {
      throw new AiError(
        `OpenCode 接口返回错误（${messageRes.status}）：${(await messageRes.text()).slice(0, 200)}`,
      )
    }
    const data = (await messageRes.json()) as OpenCodeMessageResponse
    const text = (data.parts ?? [])
      .filter(
        (p): p is OpenCodeTextPart =>
          !!p &&
          typeof p === 'object' &&
          (p as { type?: unknown }).type === 'text' &&
          typeof (p as { text?: unknown }).text === 'string',
      )
      .map((p) => p.text)
      .join('')
    if (!text.trim()) {
      throw new AiError('OpenCode 返回内容为空')
    }
    return text
  }
}