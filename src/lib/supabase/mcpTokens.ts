'use client'

/**
 * MCP 设备访问令牌（SQLite 本地版）：全部走本机服务端 API `/api/mcp-access-tokens`。
 * 浏览器永不接触 token_hash；原始令牌仅在创建时返回一次。
 */

export type McpAccessTokenInfo = {
  id: string
  label: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
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

async function parseError(response: Response, fallback: string): Promise<never> {
  const payload: unknown = await response.json().catch(() => null)
  const error = (payload as { error?: unknown } | null)?.error
  throw new Error(typeof error === 'string' ? error : fallback)
}

/** 生成供 mcp/prompt-server/.env.local 填写的两行环境变量。 */
export function buildMcpEnvText(accessToken: string): string | null {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (!origin) return null
  return [
    `PROMPT_MANAGER_URL=${origin}`,
    `PROMPT_MANAGER_ACCESS_TOKEN=${accessToken}`,
  ].join('\n')
}

export async function listMcpAccessTokens(): Promise<McpAccessTokenInfo[]> {
  const response = await fetch('/api/mcp-access-tokens', { cache: 'no-store' })
  if (!response.ok) return parseError(response, '无法读取 MCP 访问令牌')
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('无法读取 MCP 访问令牌')
  return data
}

/** 返回一次性明文令牌；数据库只保存 SHA-256 哈希，明文不会再被读取。 */
export async function createMcpAccessToken(label: string): Promise<{ token: string; info: McpAccessTokenInfo }> {
  const response = await fetch('/api/mcp-access-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  const payload: unknown = await response.json().catch(() => null)
  const result = payload as { error?: unknown; token?: unknown; info?: unknown }
  if (!response.ok) return parseError(response, '创建 MCP 访问令牌失败')
  if (typeof result?.token !== 'string' || !isMcpAccessTokenInfo(result.info)) {
    throw new Error('创建 MCP 访问令牌失败')
  }
  return { token: result.token, info: result.info }
}

export async function revokeMcpAccessToken(id: string): Promise<void> {
  const response = await fetch('/api/mcp-access-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'revoke' }),
  })
  if (!response.ok) return parseError(response, '撤销 MCP 访问令牌失败')
}