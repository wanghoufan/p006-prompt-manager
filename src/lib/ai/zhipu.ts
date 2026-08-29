import { BaseAIAdapter } from './adapter'
import type { AIConfig } from './types'

export const ZHIPU_DEFAULT_MODEL = 'glm-4-plus'
export const ZHIPU_DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

/** 智谱（GLM 系列）：OpenAI 兼容 /api/paas/v4/chat/completions。 */
export class ZhipuAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || ZHIPU_DEFAULT_MODEL,
      baseUrl: config.baseUrl || ZHIPU_DEFAULT_BASE_URL,
    })
  }
}