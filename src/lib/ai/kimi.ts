import { BaseAIAdapter } from './adapter'
import type { AIConfig } from './types'

export const KIMI_DEFAULT_MODEL = 'moonshot-v1-8k'
export const KIMI_DEFAULT_BASE_URL = 'https://api.moonshot.cn/v1'

/** Kimi（月之暗面）：OpenAI 兼容 /v1/chat/completions。 */
export class KimiAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || KIMI_DEFAULT_MODEL,
      baseUrl: config.baseUrl || KIMI_DEFAULT_BASE_URL,
    })
  }
}