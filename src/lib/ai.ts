import { createAIAdapter } from '@/lib/ai/factory'
import { AiError } from '@/lib/ai/adapter'
import type { AIConfig, AIProvider, ChatMessage, ChatOptions } from '@/lib/ai/types'
import { DEFAULT_THINKING_PROMPT, META_PROMPT } from '@/lib/prompts'
import { normalizeTags } from '@/lib/cards'
import { getState } from '@/lib/serverStore'
import type { GenerateMetaResult, Settings } from '@/lib/types'

export { AiError } from '@/lib/ai/adapter'

export type BodyAlignment = 'left' | 'center' | 'right'

const AI_PROVIDERS = [
  'deepseek',
  'zhipu',
  'tencent',
  'doubao',
  'kimi',
  'google',
  'openai',
  'openrouter',
  'opencode',
] as const

/** Phase 3：从服务端共享设置解析 AI 配置，缺省回退环境变量（.env.local）。
 *  model/baseUrl 留空时由具体 Adapter 构造器填充厂商默认值（见 DeepSeekAdapter）。
 *  P1-AI1：可传入本次请求的覆盖项（API Key 由客户端经请求头传递，不落共享存储）。 */
export async function resolveAIConfig(override?: Partial<AIConfig>): Promise<AIConfig> {
  const s = await getState()
  const st = (s.settings && typeof s.settings === 'object' ? s.settings : {}) as Partial<Settings>
  const provider = (AI_PROVIDERS as readonly string[]).includes(override?.provider ?? st.aiProvider ?? '')
    ? ((override?.provider ?? st.aiProvider) as AIProvider)
    : 'deepseek'
  const storedKey = typeof st.aiApiKey === 'string' && st.aiApiKey.trim() ? st.aiApiKey.trim() : ''
  return {
    provider,
    model:
      typeof override?.model === 'string' && override.model.trim()
        ? override.model.trim()
        : typeof st.aiModel === 'string'
          ? st.aiModel.trim()
          : '',
    apiKey:
      typeof override?.apiKey === 'string' && override.apiKey.trim()
        ? override.apiKey.trim()
        : storedKey || (process.env.DEEPSEEK_API_KEY ?? ''),
    baseUrl:
      typeof override?.baseUrl === 'string' && override.baseUrl.trim()
        ? override.baseUrl.trim()
        : typeof st.aiBaseUrl === 'string'
          ? st.aiBaseUrl.trim()
          : '',
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
  const content = await chat([{ role: 'user', content: prompt }], { maxTokens: 600 }, override)
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
