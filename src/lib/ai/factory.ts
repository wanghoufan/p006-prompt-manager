import { DeepSeekAdapter } from './deepseek'
import { OpenRouterAdapter } from './openrouter'
import { OpenCodeAdapter } from './opencode'
import type { AIAdapter, AIConfig } from './types'

export function createAIAdapter(config: AIConfig): AIAdapter {
  switch (config.provider) {
    case 'deepseek':
      return new DeepSeekAdapter(config)
    case 'openrouter':
      return new OpenRouterAdapter(config)
    case 'opencode':
      return new OpenCodeAdapter(config)
    case 'opencode-go':
      return new OpenCodeAdapter(config)
    default:
      throw new Error(`不支持的AI服务: ${config.provider}`)
  }
}
