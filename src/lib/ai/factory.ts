import { DeepSeekAdapter } from './deepseek'
import { ZhipuAdapter } from './zhipu'
import { TencentAdapter } from './tencent'
import { DoubaoAdapter } from './doubao'
import { KimiAdapter } from './kimi'
import { GoogleAdapter } from './google'
import { OpenAIAdapter } from './openai'
import { OpenRouterAdapter } from './openrouter'
import type { AIAdapter, AIConfig } from './types'

export function createAIAdapter(config: AIConfig): AIAdapter {
  switch (config.provider) {
    case 'deepseek':
      return new DeepSeekAdapter(config)
    case 'zhipu':
      return new ZhipuAdapter(config)
    case 'tencent':
      return new TencentAdapter(config)
    case 'doubao':
      return new DoubaoAdapter(config)
    case 'kimi':
      return new KimiAdapter(config)
    case 'google':
      return new GoogleAdapter(config)
    case 'openai':
      return new OpenAIAdapter(config)
    case 'openrouter':
      return new OpenRouterAdapter(config)
    default:
      throw new Error(`不支持的AI服务: ${config.provider}`)
  }
}