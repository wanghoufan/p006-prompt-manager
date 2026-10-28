/**
 * 浏览器端直连 AI（GitHub Pages 静态试用版 / 自定义 OpenAI 兼容端点）。
 *
 * 背景：静态导出产物没有 Node 运行时，原来的 `/api/ai/*` 代理不存在。已验证
 * DeepSeek 官方 API 的 CORS 预检会回 `access-control-allow-origin: <当前 origin>`，
 * 因此浏览器可以直接带着用户自己的 Key 调用任意「OpenAI 兼容」端点。
 *
 * 约束：
 * - 不预置任何 Key，也不内置任何服务商凭据；配置只从用户浏览器的 localStorage 读取。
 * - 请求体走标准 OpenAI 兼容格式（model / messages / temperature / max_tokens）。
 * - 错误文案要人话：401/403、429、CORS 各给一条能执行的下一步。
 */
import { AiError, extractErrorReason, PROVIDER_LABELS } from '@/lib/ai/adapter'
import { AI_DEFAULT_BASE_URLS, type AIConfig, type AIProvider, type ChatMessage, type ChatOptions } from '@/lib/ai/types'

/** 连接测试超时（推理模型首字可能很慢，与设置页原有 100s 保持一致）。 */
export const BROWSER_AI_TIMEOUT_MS = 100_000

/**
 * 把用户填的 baseUrl 归一化成「OpenAI 兼容根路径」：
 * - 去掉尾部斜杠；
 * - 已带 /chat/completions 时先剥掉（用户可能直接粘了完整端点）；
 * - 不强行补 /v1：DeepSeek 的 `https://api.deepseek.com` 与 `.../v1` 都可用，
 *   OpenAI 官方风格的端点通常自己带 /v1，重复拼会 404。
 */
export function normalizeAiBaseUrl(raw: string, provider: AIProvider): string {
  const fallback = AI_DEFAULT_BASE_URLS[provider] ?? ''
  let url = (raw || '').trim() || fallback
  url = url.replace(/\/+$/, '')
  url = url.replace(/\/chat\/completions$/i, '').replace(/\/+$/, '')
  return url
}

export function chatCompletionsUrl(baseUrl: string, provider: AIProvider): string {
  const root = normalizeAiBaseUrl(baseUrl, provider)
  if (!root) throw new AiError('尚未填写请求地址（Base URL）', 503)
  return `${root}/chat/completions`
}

function modelsUrl(baseUrl: string, provider: AIProvider): string {
  const root = normalizeAiBaseUrl(baseUrl, provider)
  if (!root) throw new AiError('尚未填写请求地址（Base URL）', 503)
  return `${root}/models`
}

/** 把 fetch 抛出的异常翻译成「浏览器层面」的可读原因。
 *  跨域失败在浏览器里只能拿到 TypeError: Failed to fetch（真实原因被安全策略隐藏），
 *  所以这里直接给出最可能的原因和下一步。 */
function networkFailure(e: unknown): AiError {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return new AiError('请求超时或已取消，请稍后重试', 408)
  }
  const detail = e instanceof Error && e.message ? `（${e.message}）` : ''
  return new AiError(
    `请求被浏览器拦截${detail}：请检查「请求地址」是否正确，以及该服务是否允许浏览器跨域（CORS）。` +
      'DeepSeek 官方地址支持直连；自建网关需要放行 OPTIONS 预检与 Authorization 头。',
    0,
  )
}

/** 上游 HTTP 错误 → 人话。 */
function httpFailure(label: string, status: number, rawBody: string): AiError {
  const reason = extractErrorReason(rawBody)
  const snippet = (reason || rawBody.trim()).slice(0, 200)
  const suffix = snippet ? `（上游：${snippet}）` : ''
  // 模型名/额度类错误同样会返回 401/402，先按文本识别，避免一律误报「Key 无效」。
  if (/insufficient balance|insufficient quota|exceeded your current quota|out of credit|billing/i.test(snippet)) {
    return new AiError(`账户余额或额度不足${suffix}，请到服务商控制台充值后重试`, status)
  }
  if (/model.*(not found|not supported|does not exist|is disabled|unavailable)|unknown model/i.test(snippet)) {
    return new AiError(`模型不可用${suffix}，请更换模型名称`, status)
  }
  if (status === 401 || status === 403) {
    return new AiError(`API Key 无效或无权限${suffix}`, status)
  }
  if (status === 429) {
    return new AiError(`触发限流，稍后再试${suffix}`, status)
  }
  if (status === 404) {
    return new AiError(`接口地址不存在（404）${suffix}，请检查「请求地址」是否包含正确的版本路径`, status)
  }
  return new AiError(`${label} 接口返回错误（HTTP ${status}）${suffix || '：未提供错误信息'}`, status)
}

function readContent(data: unknown): string {
  const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
    ?.content
  return typeof content === 'string' ? content : ''
}

export interface BrowserChatOptions extends ChatOptions {
  signal?: AbortSignal
}

/**
 * 浏览器直连 OpenAI 兼容端点。
 * @param config 必须是用户本机配置（provider / model / apiKey / baseUrl）
 */
export async function browserChat(
  messages: ChatMessage[],
  options: BrowserChatOptions,
  config: AIConfig,
): Promise<string> {
  const label = PROVIDER_LABELS[config.provider] ?? 'AI'
  const apiKey = (config.apiKey || '').trim()
  if (!apiKey) {
    throw new AiError('尚未配置 API Key：请到「设置 → AI 服务」填写你自己的 Key（只存在本机浏览器）', 503)
  }
  if (!config.model) {
    throw new AiError('尚未填写模型名称：请到「设置 → AI 服务」填写或拉取模型列表', 503)
  }

  const endpoint = chatCompletionsUrl(config.baseUrl ?? '', config.provider)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BROWSER_AI_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort)

  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.5,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
      signal: controller.signal,
    })
  } catch (e) {
    throw networkFailure(e)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }

  if (!res.ok) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 500)
    } catch {
      // ignore
    }
    throw httpFailure(label, res.status, body)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new AiError(`${label} 返回了无法解析的响应（不是 JSON），请检查请求地址是否指向 OpenAI 兼容接口`)
  }
  const content = readContent(data)
  if (!content.trim()) {
    throw new AiError(`${label} 返回内容为空，请重试或更换模型`)
  }
  return content
}

/** GET {baseUrl}/models：拉取可用模型 id（失败按同一套人话规则抛错）。 */
export async function browserListModels(config: AIConfig): Promise<string[]> {
  const label = PROVIDER_LABELS[config.provider] ?? 'AI'
  const apiKey = (config.apiKey || '').trim()
  if (!apiKey) {
    throw new AiError('请先填写 API Key，再拉取模型列表', 503)
  }
  const endpoint = modelsUrl(config.baseUrl ?? '', config.provider)
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch (e) {
    throw networkFailure(e)
  }
  if (!res.ok) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 500)
    } catch {
      // ignore
    }
    throw httpFailure(label, res.status, body)
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new AiError('模型列表接口返回的不是 JSON，该服务可能不支持 /models')
  }
  const list = (data as { data?: { id?: unknown }[] })?.data
  if (!Array.isArray(list)) {
    throw new AiError('模型列表响应结构不符合预期（缺少 data 数组）')
  }
  return list
    .map((m) => (typeof m?.id === 'string' ? m.id.trim() : ''))
    .filter((id): id is string => !!id)
    .sort()
}
