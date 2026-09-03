import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabasePublicConfig, PROMPT_MANAGER_SCHEMA } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

type CreateTokenRequest = { label?: unknown }

function responseError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStoreHeaders })
}

function readBearerToken(request: Request): string | null {
  const value = request.headers.get('authorization')
  if (!value?.startsWith('Bearer ')) return null
  const token = value.slice('Bearer '.length).trim()
  return token || null
}

function createAccessToken(): string {
  // 令牌属于凭据，必须由 Node Web Server 的加密随机源生成；不能退回 Math.random()。
  return `pmat_${randomBytes(32).toString('hex')}`
}

export async function POST(request: Request) {
  const accessToken = readBearerToken(request)
  if (!accessToken) return responseError('请先登录云端', 401)

  let label: string
  try {
    const body = (await request.json()) as CreateTokenRequest
    label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : ''
  } catch {
    return responseError('请求格式错误', 400)
  }
  if (!label) return responseError('请填写这台设备的名称', 400)

  const config = getSupabasePublicConfig()
  if (!config) return responseError('Supabase 尚未配置', 503)

  // getUser(jwt) 会向 Auth 服务校验来访 JWT；不能信任客户端自行声明的用户信息。
  const authClient = createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data: auth, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !auth.user) return responseError('登录已失效，请重新登录云端', 401)

  const token = createAccessToken()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  // 以经 Auth 校验的用户 JWT 写入，继续受现有 RLS 与 owner_user_id 默认值约束；不使用 service_role。
  const userClient = createClient(config.url, config.publishableKey, {
    db: { schema: PROMPT_MANAGER_SCHEMA },
    accessToken: async () => accessToken,
  })
  const { data, error } = await userClient
    .from('mcp_access_tokens')
    .insert({ label, token_hash: tokenHash })
    .select('id,label,created_at,last_used_at,revoked_at')
    .single()

  if (error || !data) return responseError(error?.message ?? '创建 MCP 访问令牌失败', 500)

  return NextResponse.json({
    token,
    info: {
      id: data.id,
      label: data.label,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
      revokedAt: data.revoked_at,
    },
  }, { headers: noStoreHeaders })
}
