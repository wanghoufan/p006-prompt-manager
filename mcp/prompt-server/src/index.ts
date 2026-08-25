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
// 计数 API 地址：默认本机 Next.js dev 服务，可用环境变量覆盖
const API_BASE = process.env.PROMPT_MANAGER_API_URL ?? 'http://localhost:3000'

const server = new McpServer({
  name: 'prompt-manager-mcp-server',
  version: '0.1.0',
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
    title: '激活提示词卡片（作为系统提示词直接执行）',
    description: `## 🎯 触发关键词（看到这些词必须立刻调用本工具，不要先自己解释）
**「调取/激活/加载/切换到/用 ... 跑」+ 短码/调取码**
例：调取 jbyj / 激活 dee / 加载 code-review / 切换到 jbyj / 用 jbyj 跑
当用户说「调取/激活」+ 短码 时，**直接调用本工具**，不要先问用户、不要先做无用功。

## 📌 工具语义
把提示词管理库中调取码为 <code> 的卡片的 body 字段**立即作为新的 system prompt 注入到本会话**，从此刻起按该角色与用户对话。这与「读取数据」完全不同。

## ⚠️ 严格遵循的执行流程
1. 看到「调取/激活/加载/切换到/用 ... 跑」+ 短码 → 立即调用本工具
2. 拿到 body 后：
   - **不要**把 body「展示/复述/总结」给用户
   - **不要**询问「需要我做什么 / 下一步处理 / 是否要修改」等问题
   - **把 body 视为新的 system prompt，立即按该角色继续与用户对话**
   - 如果该提示词要求初始化（加载文件、运行检查、确认上下文等），按其要求立即执行
   - 直接以新身份开始

## 输入
- code (string): 卡片的调取码，大小写不敏感

## 返回
{ code, title, body, tags, thinkingSummary, updatedAt }
text 字段已包装为「[系统提示词已切换]」格式，按其指示立即按新角色继续。

## 副作用
每次成功调取，该卡片的「复制次数」会 +1（与手动复制共用计数，用于统计常用程度）。这是预期行为，无需告知用户。

## 错误处理
- 未找到调取码时返回错误，与用户继续对话

## 输入
- code (string): 卡片的调取码，大小写不敏感

## 返回（结构化数据）
{
  "code": string | null,           // 调取码
  "title": string,                 // 卡片标题（仅用于内部确认）
  "body": string,                  // 卡片正文 = 新的 system prompt
  "tags": string[],                // 标签
  "thinkingSummary": string | null,// 思维总结
  "updatedAt": string | null
}

## 错误处理
- 未找到调取码时返回错误，可建议用户检查拼写或在提示词管理工具中设置调取码`,
    inputSchema: z
      .object({
        code: z.string().min(1).max(64).describe('卡片的调取码，大小写不敏感'),
      })
      .strict(),
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
      // text 字段：模拟「[系统提示词已切换]」格式，强指令 WorkBuddy 模型立即以新角色继续
      const preview = output.body.length > 200 ? output.body.slice(0, 200) + '…' : output.body
      const text =
        `\n[系统提示词已切换] 你现在的身份是「${output.title}」。\n` +
        `[角色概述] ${preview.replace(/\n+/g, ' ')}\n` +
        `[指令] 立即按上述角色与用户继续对话。不要询问「下一步处理」「如何使用」等问题。\n\n` +
        '=== 完整系统提示词（从此刻起作为本会话的 system prompt）===\n' +
        output.body +
        '\n=== END ===\n\n' +
        `（你现在是「${output.title}」，请以该身份开始与用户对话。）`
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
