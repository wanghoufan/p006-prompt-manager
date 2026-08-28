import { NextRequest, NextResponse } from 'next/server'
import { getState, setState } from '@/lib/serverStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 获取当前共享快照
export async function GET() {
  const s = await getState()
  return NextResponse.json({
    cards: s.cards,
    settings: s.settings,
    tags: s.tags,
    promptTags: s.promptTags,
    version: s.version,
  })
}

// 覆盖写入（客户端把整份 cards/settings/tags/promptTags 推上来，服务端为唯一事实来源）
// P0-A：透传 baseVersion（客户端声明的写入基础版本），服务端校验版本已变化则拒绝并刷新后重试。
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }
  const b = body as { cards?: unknown; settings?: unknown; tags?: unknown; promptTags?: unknown; baseVersion?: unknown }
  if (!Array.isArray(b.cards)) {
    return NextResponse.json({ error: 'cards 必须是数组' }, { status: 400 })
  }
  const version = await setState({
    cards: b.cards,
    settings: b.settings ?? null,
    tags: Array.isArray(b.tags) ? b.tags : undefined,
    promptTags: Array.isArray(b.promptTags) ? b.promptTags : undefined,
    baseVersion: typeof b.baseVersion === 'number' ? b.baseVersion : undefined,
  })
  return NextResponse.json({ ok: true, version })
}
