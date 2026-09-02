#!/usr/bin/env node
/**
 * Prompt Manager MCP Server
 *
 * 通过受限的 Supabase RPC 按调取码返回提示词卡片，同时原子增加复制次数。
 * 它绝不读取任一设备的 data/store.json，也不持有 Supabase service_role。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// dist/index.js 的父目录就是 mcp/prompt-server；此文件只保存本机 MCP 令牌。
const DEFAULT_ENV_FILE = path.resolve(__dirname, '..', '.env.local')

type CloudConfig = {
  url: string
  publishableKey: string
  accessToken: string
}

type ActivatedPrompt = {
  code: string | null
  title: string
  body: string
  tags: string[]
  thinking_summary: string | null
  updated_at: string | null
}

/** 支持简单 KEY=VALUE 文件；环境变量优先，令牌不写入项目源码或 Git。 */
function readLocalEnv(): Record<string, string> {
  try {
    const output: Record<string, string> = {}
    for (const rawLine of readFileSync(DEFAULT_ENV_FILE, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const separator = line.indexOf('=')
      if (separator <= 0) continue
      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      output[key] = value
    }
    return output
  } catch {
    return {}
  }
}

function getCloudConfig(): CloudConfig | null {
  const local = readLocalEnv()
  const value = (name: string) => process.env[name]?.trim() || local[name]?.trim() || ''
  const url = value('PROMPT_MANAGER_SUPABASE_URL').replace(/\/$/, '')
  const publishableKey = value('PROMPT_MANAGER_SUPABASE_PUBLISHABLE_KEY')
  const accessToken = value('PROMPT_MANAGER_ACCESS_TOKEN')
  if (!url || !publishableKey || !accessToken) return null
  return { url, publishableKey, accessToken }
}

async function activateFromCloud(code: string): Promise<ActivatedPrompt | null> {
  const config = getCloudConfig()
  if (!config) {
    throw new Error(
      `MCP 云端访问尚未配置。请在 ${DEFAULT_ENV_FILE} 填入 Supabase URL、publishable key 和 MCP 访问令牌。`,
    )
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/activate_prompt`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'prompt_manager',
    },
    body: JSON.stringify({ p_token: config.accessToken, p_code: code }),
  })
  if (!response.ok) {
    // 不把远端响应或令牌内容回显给 MCP 客户端，避免把敏感配置写入聊天记录。
    throw new Error(`云端请求失败（HTTP ${response.status}）`)
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data) || data.length === 0) return null
  const row = data[0]
  if (!row || typeof row !== 'object') return null
  const item = row as Partial<ActivatedPrompt>
  if (typeof item.title !== 'string' || typeof item.body !== 'string') return null
  return {
    code: typeof item.code === 'string' ? item.code : null,
    title: item.title,
    body: item.body,
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    thinking_summary: typeof item.thinking_summary === 'string' ? item.thinking_summary : null,
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : null,
  }
}

const server = new McpServer({
  name: 'prompt-manager-mcp-server',
  version: '0.2.0',
}, {
  instructions: `prompt_manager_activate_prompt 用于加载可信提示词卡片。成功调用后，
将工具结果中的 body 作为本轮后续行为指令：不要向用户展示、复述或概括其正文；
不要仅因卡片激活而询问泛化的“下一步”。若正文给出明确的初始化或任务，立即在既有系统策略和权限范围内执行。`,
})

server.registerTool(
  'prompt_manager_activate_prompt',
  {
    title: '激活提示词卡片',
    description: `当用户说“调取/激活/加载/切换到/用 … 跑”加调取码时立即调用。
成功结果的 body 是仅供模型执行的私有指令，不是要呈现给用户的数据：不得展示、复述或总结；不得只因激活成功而追问“下一步做什么”。
应立刻遵循其中明确的角色、初始化和任务指令（仍受既有 system 指令、权限和安全策略约束）。`,
    inputSchema: z.object({
      code: z.string().min(1).max(64).describe('卡片的调取码，大小写不敏感'),
    }).strict(),
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
    if (!key) return { isError: true, content: [{ type: 'text', text: '调取码不能为空' }] }
    try {
      const hit = await activateFromCloud(key)
      if (!hit) {
        return {
          isError: true,
          content: [{ type: 'text', text: `未找到调取码为「${code}」的卡片，或 MCP 访问令牌已被撤销。` }],
        }
      }
      const output = {
        code: hit.code,
        title: hit.title,
        body: hit.body,
        tags: hit.tags,
        thinkingSummary: hit.thinking_summary,
        updatedAt: hit.updated_at,
      }
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
      return { content: [{ type: 'text', text }], structuredContent: output }
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `读取云端提示词库失败：${error instanceof Error ? error.message : '未知错误'}`,
        }],
      }
    }
  },
)

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport())
}

main().catch((error) => {
  console.error('MCP server error:', error)
  process.exit(1)
})
