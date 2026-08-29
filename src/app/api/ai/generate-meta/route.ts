import { NextResponse } from 'next/server'
import { AiError, generateMeta } from '@/lib/ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let bodyText: string
  let existingTags: string[]
  try {
    const data: unknown = await request.json()
    const obj = data as { body?: unknown; existingTags?: unknown }
    bodyText = typeof obj.body === 'string' ? obj.body.trim() : ''
    existingTags = Array.isArray(obj.existingTags)
      ? obj.existingTags.filter((t): t is string => typeof t === 'string')
      : []
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
  if (!bodyText) {
    return NextResponse.json({ error: '正文不能为空' }, { status: 400 })
  }
  try {
    const { title, tags } = await generateMeta(bodyText, existingTags)
    return NextResponse.json({ title, tags })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI 调用失败'
    return NextResponse.json({ error: message }, { status: e instanceof AiError ? e.status : 502 })
  }
}
