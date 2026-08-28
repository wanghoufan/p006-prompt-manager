import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FETCH_TIMEOUT_MS = 8_000

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, entity: string) => {
      const codePoint = entity[0].toLowerCase() === 'x' ? Number.parseInt(entity.slice(1), 16) : Number.parseInt(entity, 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ''
    })
}

function extractTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)
  if (!match) return null
  const title = decodeHtml(match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
  return title || null
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')?.trim()
  if (!rawUrl) return NextResponse.json({ error: '缺少 URL 参数' }, { status: 400 })

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'URL 格式不正确' }, { status: 400 })
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return NextResponse.json({ error: '仅支持不含凭据的 HTTP(S) 链接' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Prompt-Manager/1.0 (title preview)' },
    })
    if (!response.ok) return NextResponse.json({ error: '网页请求失败' }, { status: 502 })
    const html = await response.text()
    const title = extractTitle(html)
    if (!title) return NextResponse.json({ error: '网页未包含标题' }, { status: 422 })
    return NextResponse.json({ title })
  } catch {
    return NextResponse.json({ error: '无法获取网页标题' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
