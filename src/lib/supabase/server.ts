import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from './config'

/**
 * 给后续 Route Handler / Server Component 使用的、携带当前用户 Cookie 的客户端。
 * 这里故意只使用 publishable key：数据库权限由用户 JWT + RLS 决定，业务代码不持有 service_role。
 */
export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig()
  if (!config) return null

  const cookieStore = await cookies()
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component 无法写 Cookie；Route Handler 与 middleware 可正常刷新会话。
        }
      },
    },
  })
}
