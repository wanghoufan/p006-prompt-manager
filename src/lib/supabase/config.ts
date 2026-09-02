/** 共享 Supabase 项目的业务 Schema。禁止回退到 public。 */
export const PROMPT_MANAGER_SCHEMA = 'prompt_manager'

export type SupabasePublicConfig = {
  url: string
  publishableKey: string
}

/**
 * 未配置时返回 null，使当前 JSON 同步在云端迁移完成前继续可用。
 * publishable key 可出现在浏览器；secret/service_role 绝不可在此读取。
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey) return null
  return { url, publishableKey }
}
