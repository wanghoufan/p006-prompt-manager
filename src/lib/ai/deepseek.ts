import { BaseAIAdapter } from './adapter'
import { DEFAULT_AI_MODEL } from './types'
import type { AIConfig } from './types'

export const DEEPSEEK_DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || DEFAULT_AI_MODEL
export const DEEPSEEK_DEFAULT_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(
  /\/+$/,
  '',
)

export class DeepSeekAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || DEEPSEEK_DEFAULT_MODEL,
      baseUrl: config.baseUrl || DEEPSEEK_DEFAULT_BASE_URL,
    })
  }
}