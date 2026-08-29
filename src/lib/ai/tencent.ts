import { BaseAIAdapter } from './adapter'
import type { AIConfig } from './types'

export const TENCENT_DEFAULT_MODEL = 'hunyuan-turbo'
export const TENCENT_DEFAULT_BASE_URL = 'https://api.hunyuan.cloud.tencent.com/v1'

/** 腾讯混元：OpenAI 兼容 /v1/chat/completions。 */
export class TencentAdapter extends BaseAIAdapter {
  constructor(config: AIConfig) {
    super({
      ...config,
      model: config.model || TENCENT_DEFAULT_MODEL,
      baseUrl: config.baseUrl || TENCENT_DEFAULT_BASE_URL,
    })
  }
}