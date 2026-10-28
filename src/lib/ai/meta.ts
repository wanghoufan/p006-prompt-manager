/**
 * AI 助手的纯逻辑层：提示词拼装 + 响应解析。
 *
 * 这一层不能 import 任何服务端模块（serverStore / sqlite / node:fs 等）：
 * 服务端 `src/lib/ai.ts`（走 /api/ai/*）与浏览器直连 `src/lib/ai/browser.ts`
 * （GitHub Pages 静态试用版，用户自备 Key）共用同一份逻辑，避免复制两份实现。
 */
import { AiError } from '@/lib/ai/adapter'
import { normalizeTags } from '@/lib/cards'
import { DEFAULT_THINKING_PROMPT, META_PROMPT } from '@/lib/prompts'
import type { GenerateMetaResult } from '@/lib/types'

export type BodyAlignment = 'left' | 'center' | 'right'

const ALIGNMENT_LABELS: Record<BodyAlignment, string> = {
  left: '左对齐',
  center: '居中',
  right: '右对齐',
}

/** 从模型回复里捞出 JSON 候选（容忍 ```json 围栏与前后解释文字）。 */
export function extractJsonCandidates(text: string): unknown[] {
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

export function buildMetaPrompt(body: string, existingTags: string[]): string {
  const existing =
    existingTags.length > 0 ? existingTags.map((t) => `- ${t}`).join('\n') : '（暂无）'
  return META_PROMPT.replace('{existingTags}', existing) + `\n\n提示词正文：\n${body}`
}

/** 解析「生成标题 + 标签」的模型输出。结构不符时抛 AiError（文案直接给用户看）。 */
export function parseMetaResult(content: string): GenerateMetaResult {
  const candidates = extractJsonCandidates(content)
  if (candidates.length === 0) {
    throw new AiError('AI 返回内容中没有可解析的 JSON，请重试或更换模型')
  }
  const obj = candidates.find(
    (c): c is Record<string, unknown> =>
      !!c && typeof c === 'object' && !Array.isArray(c) && ('title' in c || 'tags' in c),
  )
  if (!obj) {
    throw new AiError('AI 返回的 JSON 结构不符合预期（缺少 title / tags）')
  }
  const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 20) : ''
  // P0-1：AI 标签归一走 normalizeTags（过滤 DISCARD_TAGS 脏标签，命中即丢弃，空则保持 []）
  const rawTags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string')
    : []
  return { title, tags: normalizeTags(rawTags) }
}

/** 思维总结提示词：用户自定义模板缺 {body} 时自动补在末尾。 */
export function buildThinkingPrompt(body: string, customPrompt?: string): string {
  let template = customPrompt && customPrompt.trim() ? customPrompt : DEFAULT_THINKING_PROMPT
  if (!template.includes('{body}')) {
    template = `${template}\n\n提示词正文：\n{body}`
  }
  return template.replace('{body}', body)
}

/** P0-I：保留正文语义与 Markdown 结构，仅清理粘贴造成的空白和段落排版。 */
export function buildFormatPrompt(body: string, alignment: BodyAlignment): string {
  const alignmentLabel = ALIGNMENT_LABELS[alignment] ?? ALIGNMENT_LABELS.left
  return `你是文本格式整理助手。请整理下面的提示词正文，目标为${alignmentLabel}。

要求：
1. 不得增删、改写或概括任何正文语义；不得添加说明、标题、Markdown 代码围栏。
2. 移除所有行首的前导空格和制表符，让正文靠左对齐（粘贴内容常带有多余缩进，必须清除）。
3. 移除每行行首的竖杠字符 | 或 ┃ 及其后跟随的空格（终端边框残留，必须清除）。
4. 清理尾随空白和连续空行；保留有意义的 Markdown 列表标记（- 或 *）和引用标记（>）。
5. 对齐方式由阅读器显示控制；不要为了模拟居中或右对齐而在每行前补空格。
6. 只输出整理后的正文，不要输出任何解释。

正文：
${body}`
}

/** 思维总结的输出上限（见 lib/ai.ts 历史说明：推理模型的思考 token 也算在 max_tokens 里）。 */
export const THINKING_MAX_TOKENS = 8000
export const FORMAT_MAX_TOKENS = 3000
