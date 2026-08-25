import type { NextRequest } from 'next/server'
import { getState, subscribe } from '@/lib/serverStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// SSE 实时推送：连接即发送当前版本号，服务端数据变更时广播新版本号。
// 客户端收到后重新拉取 /api/sync 即可获得最新共享数据。
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      const send = (version: number) => {
        safeEnqueue(`data: ${JSON.stringify({ version })}\n\n`)
      }

      const s = await getState()
      send(s.version)

      const unsub = subscribe(send)

      // 心跳，防止代理/浏览器断开空闲连接
      const heartbeat = setInterval(() => safeEnqueue(`: ping\n\n`), 25000)

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsub()
        closed = true
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
