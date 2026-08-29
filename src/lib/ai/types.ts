export type AIProvider =
  | 'deepseek'
  | 'zhipu'
  | 'tencent'
  | 'doubao'
  | 'kimi'
  | 'google'
  | 'openai'
  | 'openrouter'
  | 'opencode'
  | 'opencode-go'

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
