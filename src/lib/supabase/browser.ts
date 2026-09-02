'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicConfig } from './config'

let client: SupabaseClient | null | undefined

/**
 * 浏览器端唯一 Supabase 客户端。
 * 使用 PKCE 流程处理邮箱链接和第三方 OAuth 回跳；会话只保存在当前浏览器。
 * 未填 publishable key 时返回 null，防止开发阶段误连或阻断现有本地模式。
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const config = getSupabasePublicConfig()
  client = config
    ? createClient(config.url, config.publishableKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
        },
      })
    : null
  return client
}
