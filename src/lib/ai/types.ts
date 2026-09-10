/** 受支持的 AI 服务商，唯一权威清单（服务端 resolveAIConfig 与客户端 normalizeSettings 都读这里）。
 *  2026-09-10 收敛为 4 个实体 / 3 家：DeepSeek 官方、OpenRouter、OpenCode（Zen 与 Go 两个端点）。
 *  已移除 zhipu、tencent、doubao、kimi、google、openai —— 它们的模型清单维护成本高于使用频率。
 *  历史配置若指向已移除的服务商，由 normalizeSettings 回退到 deepseek，不会报错。
 *  注意：新增或删除服务商只需改这一处 + SettingsModal 的 AI_SERVICES + factory.ts 分支。 */
export const AI_PROVIDERS = ['deepseek', 'openrouter', 'opencode', 'opencode-go'] as const

export type AIProvider = (typeof AI_PROVIDERS)[number]

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
