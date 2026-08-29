import { BaseAIAdapter } from './adapter'
import type { AIConfig } from './types'

export const OPENROUTER_DEFAULT_MODEL = 'openrouter/auto'
export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

/** OpenRouter：OpenAI 兼容 /api/v1/chat/completions，可路由多家模型。 */
export class OpenRouterAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || OPENROUTER_DEFAULT_MODEL,
      baseUrl: config.baseUrl || OPENROUTER_DEFAULT_BASE_URL,
    })
  }
}