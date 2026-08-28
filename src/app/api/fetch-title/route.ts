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

function decodeJavaScriptString(value: string): string {
  return value
    .replace(/\\u([\da-f]{4})/gi, (_match, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\x([\da-f]{2})/gi, (_match, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\([\\'\"])/g, '$1')
}

function extractTitle(html: string, preferWeChatTitle: boolean): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)
  const ogTitle = /<meta\b[^>]*(?:property|name)\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/i.exec(html)
    ?? /<meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["']og:title["'][^>]*>/i.exec(html)
  // 微信文章常把标题放在页面脚本的 msg_title 变量中，<title> 则可能为空。
  const weChatTitle = /(?:var\s+)?msg_title\s*=\s*(['\"])((?:\\.|(?!\1)[\s\S])*)\1/i.exec(html)?.[2]
  const rawTitle = (preferWeChatTitle ? weChatTitle : undefined) ?? match?.[1] ?? ogTitle?.[1] ?? weChatTitle
  if (!rawTitle) return null
  const title = decodeHtml(decodeJavaScriptString(rawTitle).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
  return title || null
}

function manualTitleResponse(status: number) {
  return NextResponse.json({ error: '无法自动获取标题，请手动输入', manualTitle: true }, { status })
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
    const isWeChatArticle = url.hostname === 'mp.weixin.qq.com'
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: isWeChatArticle ? 'https://mp.weixin.qq.com/' : `${url.protocol}//${url.host}/`,
        // 此处仅为无身份的浏览器会话标识；不使用或保存用户微信 Cookie。
        Cookie: 'pgv_pvid=0; pgv_info=ssid=s0',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })
    if (!response.ok) return manualTitleResponse(502)
    const html = await response.text()
    const title = extractTitle(html, isWeChatArticle)
    if (!title) return manualTitleResponse(422)
    return NextResponse.json({ title })
  } catch {
    return manualTitleResponse(502)
  } finally {
    clearTimeout(timeout)
  }
}
