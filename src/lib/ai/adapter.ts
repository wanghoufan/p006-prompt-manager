import type { AIAdapter, AIConfig, AIProvider, ChatMessage, ChatOptions } from './types'

export class AiError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
  }
}

export type { AIAdapter } from './types'

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Go',
}

/** 从各家上游的错误响应里抽出可读原因：DeepSeek 官方是 {error:{message,type,code}}，
 *  OpenRouter 是 {error:{message,code}}，部分厂商直接给 {message}。抽不出来时退回原文。 */
function extractErrorReason(body: string): string {
  try {
    const data = JSON.parse(body) as { error?: unknown; message?: unknown }
    const error = data.error
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
    if (typeof error === 'string' && error.trim()) return error.trim()
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
    return ''
  } catch {
    return body.trim()
  }
}

/** 上游错误分类。状态码不足以区分「模型不可用 / 余额不足 / Key 无效」——实测（2026-09-10）
 *  OpenCode 与 DeepSeek 官方对「模型不存在」都返回 401 ModelError，与「Key 无效」AuthError 同码。
 *  若沿用「401 一律译成 Key 无效」，用户会拿着提示去查 Key，而真问题在模型名或余额上。
 *  因此按 error.type 与错误文本分类，且模型类与额度类必须先于鉴权类判断。
 *  所有适配器共用这一处，避免各写一套判定顺序。 */
export function describeUpstreamError(
  label: string,
  status: number,
  model: string,
  { type, reason }: { type?: string; reason: string },
): AiError {
  const kind = (type ?? '').toLowerCase()
  if (
    kind === 'modelerror' ||
    /not supported|not found|unknown model|no such model|is disabled|is unavailable|not available for|does not exist/i.test(
      reason,
    )
  ) {
    return new AiError(
      `模型 ${model} 当前不可用${reason ? `（上游：${reason}）` : ''}，请更换模型`,
      status,
    )
  }
  if (
    kind === 'insufficientbalance' ||
    /insufficient balance|insufficient quota|exceeded your current quota|out of credit|billing/i.test(
      reason,
    )
  ) {
    return new AiError(`账户余额或额度不足（上游：${reason}），请到服务商控制台充值后重试`, status)
  }
  if (status === 401 || status === 403 || kind === 'autherror') {
    return new AiError(
      `${label} 鉴权失败，API Key 无效或无权限${reason ? `（上游：${reason}）` : ''}`,
      status,
    )
  }
  return new AiError(`${label} 接口返回错误（${status}）：${reason || '未提供错误信息'}`, status)
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
      throw new AiError(
        'AI 服务尚未配置：请在「设置 → AI 服务」中填写 API Key，或在服务端 .env.local 中配置后重启服务',
        503,
      )
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
      let body = ''
      try {
        body = (await res.text()).slice(0, 500)
      } catch {
        // ignore
      }
      throw describeUpstreamError(PROVIDER_LABELS[this.provider], res.status, this.model, {
        reason: extractErrorReason(body),
      })
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
