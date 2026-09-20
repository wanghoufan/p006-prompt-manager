/** 受支持的 AI 服务商，唯一权威清单（服务端 resolveAIConfig 与客户端 normalizeSettings 都读这里）。
 *  2026-09-10 收敛为 4 个实体 / 3 家：DeepSeek 官方、OpenRouter、OpenCode（Zen 与 Go 两个端点）。
 *  已移除 zhipu、tencent、doubao、kimi、google、openai —— 它们的模型清单维护成本高于使用频率。
 *  历史配置若指向已移除的服务商，由 normalizeSettings 回退到 deepseek，不会报错。
 *  注意：新增或删除服务商只需改这一处 + SettingsModal 的 AI_SERVICES + factory.ts 分支。 */
export const AI_PROVIDERS = ['deepseek', 'openrouter', 'opencode', 'opencode-go'] as const

export type AIProvider = (typeof AI_PROVIDERS)[number]

/** 各服务商预置模型（客户端 datalist 建议项，模型字段仍允许自由输入）。 */
export const AI_MODEL_PRESETS: Record<AIProvider, readonly string[]> = {
  deepseek: ['deepseek-flash', 'deepseek-v4-pro'],
  openrouter: ['auto'],
  opencode: ['glm-5.3-flash'],
  'opencode-go': ['deepseek-v4-flash', 'glm-5.3-flash'],
}

export const DEFAULT_AI_PROVIDER: AIProvider = 'deepseek'
export const DEFAULT_AI_MODEL = 'deepseek-flash'

/** 历史模型名迁移：仅 DeepSeek 官方通道下线 deepseek-v4-flash；
 *  OpenCode Go 通道同名模型仍有效，不在此表、不迁移。 */
export const LEGACY_DEEPSEEK_MODEL_MAP: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek-flash',
}

/** 归一化模型名：迁移历史名；空值回退该服务商首个预置模型（再不济回退全局默认）。
 *  非空自定义字符串原样透传，不做白名单限制。 */
export function normalizeAiModel(provider: string, model: unknown): string {
  const raw = typeof model === 'string' && model.trim() ? model.trim() : ''
  const migrated = provider === 'deepseek' ? LEGACY_DEEPSEEK_MODEL_MAP[raw] ?? raw : raw
  if (migrated) return migrated
  return AI_MODEL_PRESETS[provider as AIProvider]?.[0] ?? DEFAULT_AI_MODEL
}

export interface AIConfig {
  provider: AIProvider
  model: string
  apiKey: string
  baseUrl?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
}

export interface AIAdapter {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
}
