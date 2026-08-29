import { BaseAIAdapter } from './adapter'
import type { AIConfig } from './types'

export const DOUBAO_DEFAULT_MODEL = 'doubao-pro-32k'
export const DOUBAO_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

/** 豆包（火山方舟）：OpenAI 兼容 /api/v3/chat/completions。模型名可为推理接入点 ID（ep-…）。 */
export class DoubaoAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || DOUBAO_DEFAULT_MODEL,
      baseUrl: config.baseUrl || DOUBAO_DEFAULT_BASE_URL,
    })
  }
}