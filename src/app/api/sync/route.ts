import { NextRequest, NextResponse } from 'next/server'
import { getState, setState } from '@/lib/serverStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 获取当前共享快照
export async function GET() {
  const s = await getState()
  return NextResponse.json({ cards: s.cards, settings: s.settings, version: s.version })
}

// 覆盖写入（客户端把整份 cards/settings 推上来，服务端为唯一事实来源）
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }
  const b = body as { cards?: unknown; settings?: unknown }
  if (!Array.isArray(b.cards)) {
    return NextResponse.json({ error: 'cards 必须是数组' }, { status: 400 })
  }
  const version = await setState({ cards: b.cards, settings: b.settings ?? null })
  return NextResponse.json({ ok: true, version })
}
