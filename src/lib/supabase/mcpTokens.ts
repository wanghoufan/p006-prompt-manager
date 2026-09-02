'use client'

import { getSupabaseBrowserClient } from './browser'
import { getSupabasePublicConfig, PROMPT_MANAGER_SCHEMA } from './config'

export type McpAccessTokenInfo = {
  id: string
  label: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

type McpAccessTokenRow = {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

function toInfo(row: McpAccessTokenRow): McpAccessTokenInfo {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function newAccessToken(): string {
  return `pmat_${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
}

export function buildMcpEnvText(accessToken: string): string | null {
  const config = getSupabasePublicConfig()
  if (!config) return null
  return [
    `PROMPT_MANAGER_SUPABASE_URL=${config.url}`,
    `PROMPT_MANAGER_SUPABASE_PUBLISHABLE_KEY=${config.publishableKey}`,
    `PROMPT_MANAGER_ACCESS_TOKEN=${accessToken}`,
  ].join('\n')
}

export async function listMcpAccessTokens(): Promise<McpAccessTokenInfo[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { data, error } = await supabase
    .schema(PROMPT_MANAGER_SCHEMA)
    .from('mcp_access_tokens')
    .select('id,label,created_at,last_used_at,revoked_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as McpAccessTokenRow[]).map(toInfo)
}

/** 返回一次性明文令牌；数据库只保存 SHA-256 哈希，明文不会再被读取。 */
export async function createMcpAccessToken(label: string): Promise<{ token: string; info: McpAccessTokenInfo }> {
  const normalizedLabel = label.trim().slice(0, 80)
  if (!normalizedLabel) throw new Error('请填写这台设备的名称')
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('请先登录云端')
  const token = newAccessToken()
  const { data, error } = await supabase
    .schema(PROMPT_MANAGER_SCHEMA)
    .from('mcp_access_tokens')
    .insert({ label: normalizedLabel, token_hash: await sha256Hex(token) })
    .select('id,label,created_at,last_used_at,revoked_at')
    .single()
  if (error || !data) throw new Error(error?.message ?? '创建 MCP 访问令牌失败')
  return { token, info: toInfo(data as McpAccessTokenRow) }
}

export async function revokeMcpAccessToken(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase
    .schema(PROMPT_MANAGER_SCHEMA)
    .from('mcp_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)
  if (error) throw new Error(error.message)
}
