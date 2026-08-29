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
] as const

/** Phase 3：从服务端共享设置解析 AI 配置，缺省回退环境变量（.env.local）。
 *  model/baseUrl 留空时由具体 Adapter 构造器填充厂商默认值（见 DeepSeekAdapter）。 */
export async function resolveAIConfig(): Promise<AIConfig> {
  const s = await getState()
  const st = (s.settings && typeof s.settings === 'object' ? s.settings : {}) as Partial<Settings>
  const provider = (AI_PROVIDERS as readonly string[]).includes(st.aiProvider ?? '')
    ? (st.aiProvider as AIProvider)
    : 'deepseek'
  return {
    provider,
    model: typeof st.aiModel === 'string' ? st.aiModel.trim() : '',
    apiKey:
      (typeof st.aiApiKey === 'string' && st.aiApiKey.trim()
        ? st.aiApiKey.trim()
        : process.env.DEEPSEEK_API_KEY) ?? '',
    baseUrl: typeof st.aiBaseUrl === 'string' ? st.aiBaseUrl.trim() : '',
  }
}

async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const adapter = createAIAdapter(await resolveAIConfig())
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

export async function generateMeta(body: string, existingTags: string[]): Promise<GenerateMetaResult> {
  const existing =
    existingTags.length > 0 ? existingTags.map((t) => `- ${t}`).join('\n') : '（暂无）'
  const prompt = META_PROMPT.replace('{existingTags}', existing) + `\n\n提示词正文：\n${body}`
  const content = await chat([{ role: 'user', content: prompt }])
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

export async function summarizeThinking(body: string, customPrompt?: string): Promise<string> {
  let template = customPrompt && customPrompt.trim() ? customPrompt : DEFAULT_THINKING_PROMPT
  if (!template.includes('{body}')) {
    template = `${template}\n\n提示词正文：\n{body}`
  }
  const prompt = template.replace('{body}', body)
  const content = await chat([{ role: 'user', content: prompt }], { maxTokens: 600 })
  return content.trim()
}

/** P0-I：保留正文语义与 Markdown 结构，仅清理粘贴造成的空白和段落排版。 */
export async function formatBody(body: string, alignment: BodyAlignment): Promise<string> {
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
  return (await chat([{ role: 'user', content: prompt }], { temperature: 0, maxTokens: 3000 })).trim()
}
