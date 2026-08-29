import { NextResponse } from 'next/server'
import { AiError, formatBody, type BodyAlignment } from '@/lib/ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BODY_LENGTH = 50_000

export async function POST(request: Request) {
  let body: string
  let alignment: BodyAlignment
  try {
    const data: unknown = await request.json()
    const value = data as { body?: unknown; alignment?: unknown }
    body = typeof value.body === 'string' ? value.body.trim() : ''
    alignment = value.alignment === 'center' || value.alignment === 'right' ? value.alignment : 'left'
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
  if (!body) return NextResponse.json({ error: '正文不能为空' }, { status: 400 })
  if (body.length > MAX_BODY_LENGTH) return NextResponse.json({ error: '正文不能超过 50000 个字符' }, { status: 400 })
  try {
    return NextResponse.json({ body: await formatBody(body, alignment) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI 调用失败'
    return NextResponse.json({ error: message }, { status: e instanceof AiError ? e.status : 502 })
  }
}
