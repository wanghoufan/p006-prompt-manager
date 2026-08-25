import { incrementCopy } from '@/lib/serverStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// MCP 调用计数：按调取码给卡片 copyCount +1（与手动复制共用）。
// 走 serverStore 内存单例，避免跨进程直接改文件与内存不一致。
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: unknown }
    const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : ''
    if (!code) {
      return Response.json({ error: '缺少 code 参数' }, { status: 400 })
    }
    const copyCount = await incrementCopy(code)
    if (copyCount === null) {
      return Response.json({ error: `未找到调取码为 ${code} 的卡片` }, { status: 404 })
    }
    return Response.json({ code, copyCount })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : '服务器错误' },
      { status: 500 },
    )
  }
}
