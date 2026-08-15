import { NextResponse } from 'next/server'
import { summarizeThinking } from '@/lib/ai'

export async function POST(request: Request) {
  let bodyText: string
  let customPrompt: string | undefined
  try {
    const data: unknown = await request.json()
    const obj = data as { body?: unknown; prompt?: unknown }
    bodyText = typeof obj.body === 'string' ? obj.body.trim() : ''
    customPrompt = typeof obj.prompt === 'string' && obj.prompt.trim() ? obj.prompt : undefined
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
  if (!bodyText) {
    return NextResponse.json({ error: '正文不能为空' }, { status: 400 })
  }
  try {
    const summary = await summarizeThinking(bodyText, customPrompt)
    return NextResponse.json({ summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI 调用失败'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}