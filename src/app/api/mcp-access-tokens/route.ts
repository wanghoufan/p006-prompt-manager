import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/sqlite'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

/**
 * MCP 设备访问令牌（SQLite 本地版）。
 *
 * - GET  → 列出全部令牌（不含 token_hash，永不回显原始令牌）；
 * - POST {label}                        → 创建，返回一次性明文令牌 + info；
 * - POST {id, action: "revoke"}         → 撤销。
 *
 * 与 /api/sync 同理：局域网信任模型，无账号体系；MCP 调取时由
 * /api/mcp/activate 单独校验令牌哈希。数据库只存 SHA-256 哈希。
 */

function responseError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStoreHeaders })
}

function createAccessToken(): string {
  // 令牌属于凭据，必须由 Node Web Server 的加密随机源生成；不能退回 Math.random()。
  return `pmat_${randomBytes(32).toString('hex')}`
}

type TokenRow = {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

function rowToInfo(row: TokenRow) {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }
}

export async function GET() {
  const rows = getDb()
    .prepare('SELECT id, label, created_at, last_used_at, revoked_at FROM mcp_access_tokens ORDER BY created_at DESC')
    .all() as unknown as TokenRow[]
  return NextResponse.json(rows.map(rowToInfo), { headers: noStoreHeaders })
}

export async function POST(request: Request) {
  let body: { label?: unknown; id?: unknown; action?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return responseError('请求格式错误', 400)
  }

  if (body.action === 'revoke') {
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return responseError('缺少令牌 id', 400)
    const result = getDb()
      .prepare('UPDATE mcp_access_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .run(new Date().toISOString(), id)
    if (result.changes === 0) return responseError('令牌不存在或已撤销', 404)
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders })
  }

  // 默认动作：创建
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : ''
  if (!label) return responseError('请填写这台设备的名称', 400)

  const token = createAccessToken()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date().toISOString()
  const id = randomUUID()
  getDb()
    .prepare(
      'INSERT INTO mcp_access_tokens (id, label, token_hash, created_at, last_used_at, revoked_at) VALUES (?, ?, ?, ?, NULL, NULL)',
    )
    .run(id, label, tokenHash, now)

  return NextResponse.json({
    token,
    info: rowToInfo({ id, label, created_at: now, last_used_at: null, revoked_at: null }),
  }, { headers: noStoreHeaders })
}