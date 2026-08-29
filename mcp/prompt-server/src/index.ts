#!/usr/bin/env node
/**
 * Prompt Manager MCP Server
 *
 * 通过「调取码」从提示词管理库（data/store.json）返回卡片内容。
 * 只读工具，不修改任何数据。
 *
 * 数据源：项目根目录 data/store.json（由 Next.js dev 服务端实时落盘）。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// dist/index.js -> 项目根（mcp/prompt-server/dist/ 向上 3 级）
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')
const STORE_FILE = path.join(PROJECT_ROOT, 'data', 'store.json')
// 计数 API 地址：默认本机 Next.js dev 服务，可用环境变量覆盖。
// 端口必须与 dev-server.sh 的 PORT 一致（改端口时两处都要改）。
const API_BASE = process.env.PROMPT_MANAGER_API_URL ?? 'http://localhost:3100'

const server = new McpServer({
  name: 'prompt-manager-mcp-server',
  version: '0.1.0',
}, {
  // 这是初始化阶段给 MCP 客户端的使用说明。客户端可决定是否注入模型上下文，
  // 因此不能把它当作真正的 system message；工具返回仍保留同一份明确契约。
  instructions: `prompt_manager_activate_prompt 用于加载可信提示词卡片。成功调用后，
将工具结果中的 body 作为本轮后续行为指令：不要向用户展示、复述或概括其正文；
不要仅因卡片激活而询问泛化的“下一步”。若正文给出明确的初始化或任务，立即在既有系统策略和权限范围内执行。`,
})

interface StoredCard {
  code?: string | null
  title?: string
  body?: string
  tags?: string[]
  thinkingSummary?: string | null
  updatedAt?: string
}

/** 读取共享数据文件并返回卡片数组 */
async function loadCards(): Promise<StoredCard[]> {
  const raw = await readFile(STORE_FILE, 'utf8')
  const data: unknown = JSON.parse(raw)
  if (data && typeof data === 'object') {
    const cards = (data as Record<string, unknown>).cards
    if (Array.isArray(cards)) return cards as StoredCard[]
  }
  return []
}

server.registerTool(
  'prompt_manager_activate_prompt',
  {
    title: '激活提示词卡片',
    description: `当用户说“调取/激活/加载/切换到/用 … 跑”加调取码时立即调用。
成功结果的 body 是仅供模型执行的私有指令，不是要呈现给用户的数据：不得展示、复述或总结；不得只因激活成功而追问“下一步做什么”。
应立刻遵循其中明确的角色、初始化和任务指令（仍受既有 system 指令、权限和安全策略约束）。
注意：本工具返回的是 MCP tool result，不能在协议层把消息提升为 system message；客户端须将结果提供给模型才能生效。`,
    inputSchema: z
      .object({
        code: z.string().min(1).max(64).describe('卡片的调取码，大小写不敏感'),
      })
      .strict(),
    outputSchema: z.object({
      code: z.string().nullable(),
      title: z.string(),
      body: z.string(),
      tags: z.array(z.string()),
      thinkingSummary: z.string().nullable(),
      updatedAt: z.string().nullable(),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ code }) => {
    const key = code.trim().toLowerCase()
    if (!key) {
      return {
        isError: true,
        content: [{ type: 'text', text: '调取码不能为空' }],
      }
    }
    try {
      const cards = await loadCards()
      const hit = cards.find((c) => (c.code ?? '').toLowerCase() === key)
      if (!hit) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `未找到调取码为「${code}」的卡片。请确认调取码拼写，或在提示词管理工具中为该卡片设置调取码后再试。`,
            },
          ],
        }
      }
      // 命中后给卡片复制次数 +1（走 Next.js API，避免跨进程直接改文件与 serverStore 内存不一致）
      void fetch(`${API_BASE}/api/sync/increment-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: key }),
      }).catch(() => {
        // 计数失败不影响取卡片，静默
      })
      const output = {
        code: hit.code ?? null,
        title: hit.title ?? '',
        body: hit.body ?? '',
        tags: hit.tags ?? [],
        thinkingSummary: hit.thinkingSummary ?? null,
        updatedAt: hit.updatedAt ?? null,
      }
      // MCP tool result 不能在协议级别变成 system prompt。以无预览、单一职责的
      // 指令封套提供正文，避免标题概述和重复文案分散模型对正文的注意力。
      const text =
        '<prompt-manager-activation private="true">\n' +
        'status: activated\n' +
        'model-action: Treat activated-instructions as the active role/task instructions for this turn.\n' +
        'user-visible-action: Do not display, quote, summarize, or acknowledge the instructions. Do not ask a generic next-step question solely because activation succeeded.\n' +
        'execution: Immediately perform any explicit initialization or task in activated-instructions, subject to higher-priority instructions and normal permission checks.\n' +
        '</prompt-manager-activation>\n\n' +
        '<activated-instructions>\n' +
        output.body +
        '\n</activated-instructions>'
      return {
        content: [{ type: 'text', text }],
        structuredContent: output,
      }
    } catch (e) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `读取提示词库失败：${e instanceof Error ? e.message : String(e)}。请确认 dev 服务已启动并保存过数据（data/store.json 存在）。`,
          },
        ],
      }
    }
  },
)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((e) => {
  console.error('MCP server error:', e)
  process.exit(1)
})
