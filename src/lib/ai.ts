import { createAIAdapter } from '@/lib/ai/factory'
import {
  buildFormatPrompt,
  buildMetaPrompt,
  buildThinkingPrompt,
  FORMAT_MAX_TOKENS,
  parseMetaResult,
  THINKING_MAX_TOKENS,
  type BodyAlignment,
} from '@/lib/ai/meta'
import { AI_PROVIDERS, normalizeAiModel, type AIConfig, type AIProvider, type ChatMessage, type ChatOptions } from '@/lib/ai/types'
import { getState } from '@/lib/serverStore'
import type { GenerateMetaResult, Settings } from '@/lib/types'

export { AiError } from '@/lib/ai/adapter'
export type { BodyAlignment } from '@/lib/ai/meta'

const AI_PROVIDER_NAMES = AI_PROVIDERS as readonly string[]

/** BUG-8：`.env` 里的值只服务于「它自己声明的那家厂商」（`AI_PROVIDER` 指到谁就服务谁）。
 *  当用户在设置页显式选了别的厂商时，env 里的 `AI_MODEL` / `AI_BASE_URL` / `AI_API_KEY`
 *  都是为原厂商准备的，继续回退会把配置串味——最严重的一条是把 A 家的 Key 发到 B 家的端点
 *  （实测 2026-09-10：生产 Key 属 OpenCode，设置页切到 DeepSeek 官方且 Key 留空后，
 *  这把 Key 被发往 api.deepseek.com，拿到 401）。
 *  此时正确行为是让适配器报「尚未配置 API Key」并提示用户填写，而不是拿别家的 Key 去试。
 *  `DEEPSEEK_API_KEY` 是「指名道姓」的变量，因此只按 provider 判断、与 AI_PROVIDER 无关，
 *  保证只填了 DEEPSEEK_* 的老部署仍然可用。 */
function resolveEnvFallbacks(provider: AIProvider, envProvider: string): {
  model: string
  baseUrl: string
  apiKey: string
} {
  const sameOrigin = provider === envProvider
  return {
    model: sameOrigin ? (process.env.AI_MODEL ?? '').trim() : '',
    baseUrl: sameOrigin ? (process.env.AI_BASE_URL ?? '').trim() : '',
    apiKey: sameOrigin
      ? (process.env.AI_API_KEY ?? '').trim()
      : provider === 'deepseek'
        ? (process.env.DEEPSEEK_API_KEY ?? '').trim()
        : '',
  }
}

/** Phase 3：从服务端共享设置解析 AI 配置，缺省回退环境变量（.env.local）。
 *  通用环境变量 AI_PROVIDER / AI_MODEL / AI_BASE_URL / AI_API_KEY 可指向任意厂商；
 *  DEEPSEEK_* 作为旧部署兼容保留，优先级低于通用变量。
 *  model/baseUrl 留空时由具体 Adapter 构造器填充厂商默认值（见 DeepSeekAdapter）。
 *  P1-AI1：可传入本次请求的覆盖项（API Key 由客户端经请求头传递，不落共享存储）。
 *  注意：custom 只走浏览器直连（见 lib/ai/browser.ts），这里仍能解析出配置，
 *  但 createAIAdapter 会给出「服务端不支持自定义服务商」的明确错误。 */
export async function resolveAIConfig(override?: Partial<AIConfig>): Promise<AIConfig> {
  const s = await getState()
  const st = (s.settings && typeof s.settings === 'object' ? s.settings : {}) as Partial<Settings>
  const providerNames = AI_PROVIDER_NAMES
  const chosen = override?.provider ?? st.aiProvider ?? ''
  const envProvider = (process.env.AI_PROVIDER ?? '').trim()
  const provider = providerNames.includes(chosen)
    ? (chosen as AIProvider)
    : providerNames.includes(envProvider)
      ? (envProvider as AIProvider)
      : 'deepseek'
  const storedKey = typeof st.aiApiKey === 'string' && st.aiApiKey.trim() ? st.aiApiKey.trim() : ''
  const env = resolveEnvFallbacks(provider, envProvider)
  const model =
    typeof override?.model === 'string' && override.model.trim()
      ? override.model.trim()
      : typeof st.aiModel === 'string' && st.aiModel.trim()
        ? st.aiModel.trim()
        : env.model
  return {
    provider,
    model: normalizeAiModel(provider, model),
    apiKey:
      typeof override?.apiKey === 'string' && override.apiKey.trim()
        ? override.apiKey.trim()
        : storedKey || env.apiKey,
    baseUrl:
      typeof override?.baseUrl === 'string' && override.baseUrl.trim()
        ? override.baseUrl.trim()
        : typeof st.aiBaseUrl === 'string' && st.aiBaseUrl.trim()
          ? st.aiBaseUrl.trim()
          : env.baseUrl,
  }
}

/** P1-AI1：从请求头解析本次 AI 调用所需的覆盖配置（Key 不经共享存储，仅本次请求生效）。 */
export function configOverrideFromHeaders(headers: Headers): Partial<AIConfig> {
  const out: Partial<AIConfig> = {}
  const provider = headers.get('x-ai-provider')
  const model = headers.get('x-ai-model')
  const baseUrl = headers.get('x-ai-base-url')
  const apiKey = headers.get('x-ai-api-key')
  if (provider) out.provider = provider as AIProvider
  if (model) out.model = model
  if (baseUrl) out.baseUrl = baseUrl
  if (apiKey) out.apiKey = apiKey
  return out
}

async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
  override?: Partial<AIConfig>,
): Promise<string> {
  const adapter = createAIAdapter(await resolveAIConfig(override))
  return adapter.chat(messages, options)
}

export async function generateMeta(
  body: string,
  existingTags: string[],
  override?: Partial<AIConfig>,
): Promise<GenerateMetaResult> {
  const content = await chat([{ role: 'user', content: buildMetaPrompt(body, existingTags) }], {}, override)
  return parseMetaResult(content)
}

export async function summarizeThinking(
  body: string,
  customPrompt?: string,
  override?: Partial<AIConfig>,
): Promise<string> {
  // 8000 而非 600：现在的可选模型大量是推理模型，思考 token 也算进输出上限。
  // 实测（2026-09-10）：muse-spark-1.2/1.3 单次思考约 1.8k–3.3k tokens，给 2000 会
  // 被思考吃满 → content 为空 → 报「返回内容为空」或回退成英文思考过程。
  // 这是上限而非目标，非推理模型仍会提前停止，不会因此多花钱。
  const content = await chat(
    [{ role: 'user', content: buildThinkingPrompt(body, customPrompt) }],
    { maxTokens: THINKING_MAX_TOKENS },
    override,
  )
  return content.trim()
}

/** P0-I：保留正文语义与 Markdown 结构，仅清理粘贴造成的空白和段落排版。 */
export async function formatBody(
  body: string,
  alignment: BodyAlignment,
  override?: Partial<AIConfig>,
): Promise<string> {
  const content = await chat(
    [{ role: 'user', content: buildFormatPrompt(body, alignment) }],
    { temperature: 0, maxTokens: FORMAT_MAX_TOKENS },
    override,
  )
  return content.trim()
}
