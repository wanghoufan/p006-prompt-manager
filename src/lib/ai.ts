import { DEFAULT_THINKING_PROMPT, META_PROMPT } from '@/lib/prompts'
import { normalizeTags } from '@/lib/cards'
import type { GenerateMetaResult } from '@/lib/types'

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
const ENDPOINT = `${BASE_URL}/chat/completions`

export class AiError extends Error {}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function chat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey || apiKey.startsWith('sk-your-key')) {
    throw new AiError('服务端未配置 DEEPSEEK_API_KEY（请检查 .env.local）')
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: options.temperature ?? 0.5,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {
      // ignore
    }
    throw new AiError(`DeepSeek 接口返回错误（${res.status}）：${detail}`)
  }
  const data: unknown = await res.json()
  const content =
    (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
      ?.content ?? ''
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiError('DeepSeek 返回内容为空')
  }
  return content
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