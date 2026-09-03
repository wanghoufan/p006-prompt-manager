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

function isMcpAccessTokenInfo(value: unknown): value is McpAccessTokenInfo {
  if (!value || typeof value !== 'object') return false
  const info = value as Partial<McpAccessTokenInfo>
  return typeof info.id === 'string'
    && typeof info.label === 'string'
    && typeof info.createdAt === 'string'
    && (typeof info.lastUsedAt === 'string' || info.lastUsedAt === null)
    && (typeof info.revokedAt === 'string' || info.revokedAt === null)
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
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (sessionError || !accessToken) throw new Error('请先登录云端')

  const response = await fetch('/api/mcp-access-tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: normalizedLabel }),
  })
  const payload: unknown = await response.json().catch(() => null)
  const result = payload as { error?: unknown; token?: unknown; info?: unknown }
  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : '创建 MCP 访问令牌失败')
  }
  if (typeof result?.token !== 'string' || !isMcpAccessTokenInfo(result.info)) {
    throw new Error('创建 MCP 访问令牌失败')
  }
  return { token: result.token, info: result.info }
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
