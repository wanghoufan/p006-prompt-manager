import { createAIAdapter } from '@/lib/ai/factory'
import { AiError } from '@/lib/ai/adapter'
import { AI_PROVIDERS, normalizeAiModel, type AIConfig, type AIProvider, type ChatMessage, type ChatOptions } from '@/lib/ai/types'
import { DEFAULT_THINKING_PROMPT, META_PROMPT } from '@/lib/prompts'
import { normalizeTags } from '@/lib/cards'
import { getState } from '@/lib/serverStore'
import type { GenerateMetaResult, Settings } from '@/lib/types'

export { AiError } from '@/lib/ai/adapter'

export type BodyAlignment = 'left' | 'center' | 'right'

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
 *  P1-AI1：可传入本次请求的覆盖项（API Key 由客户端经请求头传递，不落共享存储）。 */
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

function extractJsonCandidates(text: string): unknown[] {
  const cleaned = text.replace(/```(?:json)?\s*/g, '').trim()
  const out: unknown[] = []
  for (const [open, close] of [
    ['{', '}'],
    ['[', ']'],
  ] as const) {
    const start = cleaned.indexOf(open)
    if (start === -1) continue
    let depth = 0
    let inString = false
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i]
      if (inString) {
        if (ch === '\\') i++
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) {
          try {
            out.push(JSON.parse(cleaned.slice(start, i + 1)))
          } catch {
            // skip malformed candidates
          }
          break
        }
      }
    }
  }
  return out
}

export async function generateMeta(
  body: string,
  existingTags: string[],
  override?: Partial<AIConfig>,
): Promise<GenerateMetaResult> {
  const existing =
    existingTags.length > 0 ? existingTags.map((t) => `- ${t}`).join('\n') : '（暂无）'
  const prompt = META_PROMPT.replace('{existingTags}', existing) + `\n\n提示词正文：\n${body}`
  const content = await chat([{ role: 'user', content: prompt }], {}, override)
  const candidates = extractJsonCandidates(content)
  if (candidates.length === 0) {
    throw new AiError('AI 返回内容中没有可解析的 JSON')
  }
  const obj = candidates.find(
    (c): c is Record<string, unknown> =>
      !!c && typeof c === 'object' && !Array.isArray(c) && ('title' in c || 'tags' in c),
  )
  if (!obj) {
    throw new AiError('AI 返回的 JSON 结构不符合预期')
  }
  const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 20) : ''
  // P0-1：AI 标签归一走 normalizeTags（过滤 DISCARD_TAGS 脏标签，命中即丢弃，空则保持 []）
  const rawTags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string')
    : []
  const tags = normalizeTags(rawTags)
  return { title, tags }
}

export async function summarizeThinking(
  body: string,
  customPrompt?: string,
  override?: Partial<AIConfig>,
): Promise<string> {
  let template = customPrompt && customPrompt.trim() ? customPrompt : DEFAULT_THINKING_PROMPT
  if (!template.includes('{body}')) {
    template = `${template}\n\n提示词正文：\n{body}`
  }
  const prompt = template.replace('{body}', body)
  // 8000 而非 600：现在的可选模型大量是推理模型，思考 token 也算进输出上限。
  // 实测（2026-09-10）：muse-spark-1.2/1.3 单次思考约 1.8k–3.3k tokens，给 2000 会
  // 被思考吃满 → content 为空 → 报「返回内容为空」或回退成英文思考过程。
  // 这是上限而非目标，非推理模型仍会提前停止，不会因此多花钱。
  const content = await chat([{ role: 'user', content: prompt }], { maxTokens: 8000 }, override)
  return content.trim()
}

/** P0-I：保留正文语义与 Markdown 结构，仅清理粘贴造成的空白和段落排版。 */
export async function formatBody(
  body: string,
  alignment: BodyAlignment,
  override?: Partial<AIConfig>,
): Promise<string> {
  const alignmentLabel = { left: '左对齐', center: '居中', right: '右对齐' }[alignment]
  const prompt = `你是文本格式整理助手。请整理下面的提示词正文，目标为${alignmentLabel}。

要求：
1. 不得增删、改写或概括任何正文语义；不得添加说明、标题、Markdown 代码围栏。
2. 移除所有行首的前导空格和制表符，让正文靠左对齐（粘贴内容常带有多余缩进，必须清除）。
3. 清理尾随空白和连续空行；保留有意义的 Markdown 列表标记（- 或 *）和引用标记（>）。
4. 对齐方式由阅读器显示控制；不要为了模拟居中或右对齐而在每行前补空格。
5. 只输出整理后的正文，不要输出任何解释。

正文：
${body}`
  return (
    await chat([{ role: 'user', content: prompt }], { temperature: 0, maxTokens: 3000 }, override)
  ).trim()
}
