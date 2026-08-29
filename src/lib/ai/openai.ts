import { BaseAIAdapter } from './adapter'
import type { AIConfig } from './types'

export const OPENAI_DEFAULT_MODEL = 'gpt-4o'
export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'

/** OpenAI（GPT 系列）：OpenAI 兼容 /v1/chat/completions。 */
export class OpenAIAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || OPENAI_DEFAULT_MODEL,
      baseUrl: config.baseUrl || OPENAI_DEFAULT_BASE_URL,
    })
  }
}