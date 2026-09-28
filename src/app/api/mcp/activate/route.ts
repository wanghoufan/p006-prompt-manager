import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/sqlite'
import { activatePromptByCode } from '@/lib/serverStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

/**
 * MCP 调取激活（SQLite 本地版，替代 Supabase RPC `activate_prompt`）。
 *
 * 入参（与旧 RPC 一致）：
 *   { p_token: <设备明文令牌>, p_code: <调取码> }
 *
 * 流程：sha256(token) 比对 mcp_access_tokens（未撤销）→ 按调取码查卡 →
 * copy_count+1 / revision+1 / updated_at 刷新并广播版本（前端实时刷新）→ 返回卡片。
 */
export async function POST(req: NextRequest) {
  let body: { p_token?: unknown; p_code?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400, headers: noStoreHeaders })
  }
  const token = typeof body.p_token === 'string' ? body.p_token : ''
  const code = typeof body.p_code === 'string' ? body.p_code.trim().toLowerCase() : ''
  if (!token || token.length < 32 || !code) {
    return NextResponse.json({ error: '缺少或非法的 p_token / p_code' }, { status: 400, headers: noStoreHeaders })
  }

  const db = getDb()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const row = db
    .prepare('SELECT id FROM mcp_access_tokens WHERE token_hash = ? AND revoked_at IS NULL')
    .get(tokenHash) as { id: string } | undefined
  if (!row) {
    return NextResponse.json({ error: '令牌无效或已撤销' }, { status: 401, headers: noStoreHeaders })
  }
  db.prepare('UPDATE mcp_access_tokens SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id)

  const hit = await activatePromptByCode(code)
  if (!hit) {
    return NextResponse.json({ error: `未找到调取码为「${code}」的卡片` }, { status: 404, headers: noStoreHeaders })
  }
  return NextResponse.json(hit, { headers: noStoreHeaders })
}