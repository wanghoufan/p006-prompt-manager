import { DeepSeekAdapter } from './deepseek'
import { OpenRouterAdapter } from './openrouter'
import { OpenCodeAdapter } from './opencode'
import { AiError } from './adapter'
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
    case 'custom':
      // 自定义端点只从浏览器直连（用户自备 Key，静态站没有 Node 运行时）。
      // 服务端明确拒绝，避免把 Key 发到未登记的上游后又给出含糊的 502。
      throw new AiError(
        '自定义服务商仅支持浏览器直连，服务端不支持；请改用 DeepSeek / OpenRouter / OpenCode，或在网页试用版中使用',
        400,
      )
    default:
      throw new AiError(`不支持的服务商: ${String(config.provider)}`, 400)
  }
}
