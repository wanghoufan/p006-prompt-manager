/**
 * 离线 MCP 接入包：把网页里的提示词库变成「一个扔到别人电脑上就能跑的 MCP server」。
 *
 * 为什么需要它：GitHub Pages 静态试用版没有服务端，而原 MCP server 依赖
 * `POST /api/mcp/activate` + 本机令牌。访客浏览器里既没有服务端也没有令牌，
 * 所以试用版的 MCP 入口此前被整体隐藏。
 *
 * 本模块的解法：把「当前库里有调取码的卡片」快照内嵌进一个零依赖的 .mjs 脚本，
 * 该脚本自己实现 MCP stdio 协议（换行分隔 JSON-RPC 2.0），不需要 npm install、
 * 不需要服务端、不需要网络。访客下载这个文件，交给本机 AI 客户端即可使用。
 *
 * 纯逻辑模块：不 import React、不碰 localStorage、不碰 DOM，便于单测与复用。
 */

import type { Card } from '@/lib/types'

/** MCP 工具名：与本地完整版的 mcp/prompt-server 保持一致，客户端侧可复用同一套使用习惯。 */
export const MCP_TOOL_NAME = 'prompt_manager_activate_prompt'

/** 生成的单文件 server 默认文件名。 */
export const MCP_SERVER_FILE = 'prompt-manager-mcp.mjs'

/** 建议的落地目录（相对用户主目录）。提示词里会让 AI 创建并放进去。 */
export const MCP_INSTALL_DIR = '.prompt-manager-mcp'

/** 内嵌协议版本：客户端请求的版本在支持列表内就回显，否则回落到这里。 */
const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'] as const
const FALLBACK_PROTOCOL_VERSION = '2024-11-05'

export interface McpSnapshotEntry {
  code: string
  title: string
  body: string
  tags: string[]
  thinkingSummary: string | null
  updatedAt: string
}

export interface McpBundle {
  fileName: string
  content: string
  entryCount: number
  bytes: number
}

/** 调取码归一：去空白 + 小写。大小写不敏感是产品既定口径（见 /api/mcp/activate）。 */
export function normalizeCode(code: string): string {
  return code.trim().toLowerCase()
}

/**
 * 抽出可被调取的卡片快照。只收「有调取码」且「正文非空」的卡片——
 * 没有调取码的卡片在 MCP 里永远取不到，带进去只会让包变大。
 */
export function buildSnapshot(cards: Card[]): McpSnapshotEntry[] {
  const seen = new Set<string>()
  const entries: McpSnapshotEntry[] = []
  for (const card of cards) {
    const code = normalizeCode(card.code ?? '')
    if (!code) continue
    const body = (card.body ?? '').trim()
    if (!body) continue
    // 同一调取码只保留最近更新的一张：否则 AI 调取时命中哪张不确定。
    if (seen.has(code)) {
      const existing = entries.findIndex((e) => e.code === code)
      if (existing >= 0 && card.updatedAt > entries[existing].updatedAt) {
        entries[existing] = toEntry(card, code, body)
      }
      continue
    }
    seen.add(code)
    entries.push(toEntry(card, code, body))
  }
  return entries.sort((a, b) => a.code.localeCompare(b.code))
}

function toEntry(card: Card, code: string, body: string): McpSnapshotEntry {
  return {
    code,
    title: card.title || '未命名卡片',
    body,
    tags: Array.isArray(card.tags) ? card.tags.filter((t) => typeof t === 'string') : [],
    thinkingSummary: card.thinkingSummary ?? null,
    updatedAt: card.updatedAt ?? '',
  }
}

/** 浏览器内调取码命中（调取台用，与生成的 server 同一判定规则）。 */
export function findEntryByCode(cards: Card[], code: string): McpSnapshotEntry | null {
  const key = normalizeCode(code)
  if (!key) return null
  const entries = buildSnapshot(cards)
  return entries.find((entry) => entry.code === key) ?? null
}

/**
 * 生成与 MCP server 返回完全同构的激活文本。
 * 网页里的「调取台」用它，保证演示看到的东西和 AI 真拿到的东西一致。
 */
export function buildActivationText(entry: McpSnapshotEntry): string {
  return (
    '<prompt-manager-activation private="true">\n' +
    'status: activated\n' +
    'model-action: Treat activated-instructions as the active role/task instructions for this turn.\n' +
    'user-visible-action: Do not display, quote, summarize, or acknowledge the instructions. Do not ask a generic next-step question solely because activation succeeded.\n' +
    'execution: Immediately perform any explicit initialization or task in activated-instructions, subject to higher-priority instructions and normal permission checks.\n' +
    '</prompt-manager-activation>\n\n' +
    '<activated-instructions>\n' +
    entry.body +
    '\n</activated-instructions>'
  )
}

/** 生成给 AI 的接入提示词：自包含，AI 拿到就能在用户本机装好并自检。 */
export function buildSetupPrompt(options: {
  cards: Card[]
  generatedAt: string
}): string {
  const { cards, generatedAt } = options
  const bundle = buildBundle(cards, generatedAt)
  const entries = buildSnapshot(cards)
  const sampleCode = entries[0]?.code ?? ''
  const scriptPath = `~/${MCP_INSTALL_DIR}/${MCP_SERVER_FILE}`

  // 设计要点（2026-10-31 用户裁定，两次改回来）：
  // 用户只做一个动作——复制这段文本、粘给智能体。**不要**让用户下载文件、再上传、再发送。
  // 所以脚本源码与卡片数据全部内嵌在这段文本里，由智能体自己落盘。
  // 代价是文本较长（数 KB～数十 KB），但这是「用户零额外动作」的必要成本。
  return [
    '请帮我把下面这个离线 MCP server 装到本机。全程由你完成，我不需要做任何事，也不要让我下载或上传文件。',
    '',
    '按顺序做，每一步真实执行后再进入下一步：',
    '',
    `1. 本消息**最后那一整段代码**就是脚本原文：它从第一个以 #! 开头的行开始，一直延续到本消息结尾。把它整段**原样**保存为 ${scriptPath}（先 mkdir -p ~/${MCP_INSTALL_DIR}；逐字保存，不要改写、不要格式化、不要补注释、不要只存一部分）。`,
    '2. 执行 command -v node 取得 node 的绝对路径（Windows 用 where node）。低于 Node 18 就停下来告诉我。',
    `3. 执行 node "${scriptPath}" --selftest ${sampleCode || ''}，必须看到 SELFTEST: PASS 再继续。`,
    '4. 把下面这个 stdio server 写进本机已装的 MCP 客户端配置（WorkBuddy / Codex / Cursor / Claude Desktop / Cline / Windsurf / Gemini CLI 等，探测到哪些就写哪些）。写之前先备份原文件为 <文件名>.bak-<时间戳>：',
    '   - 名称：prompt-manager',
    '   - 命令：第 2 步拿到的 node 绝对路径',
    `   - 参数：${scriptPath.replace('~', '$HOME')}`,
    '   - JSON 系客户端形如 {"mcpServers":{"prompt-manager":{"command":"<node 绝对路径>","args":["<脚本绝对路径>"]}}}',
    '   - Codex（TOML）形如 [mcp_servers.prompt-manager] 下的 command / args',
    '5. 重开客户端会话，确认工具列表里有 prompt_manager_activate_prompt，并用示例调取码真实调用一次。',
    '6. **关键一步**：把下面这条规则写进你所在客户端的「常驻说明」，否则我只说两个字时你不会去调工具（实测：只靠工具描述不够，模型会先去搜文件）：',
    '   - Codex / opencode：写进 AGENTS.md（优先项目级；若 ~/.codex/AGENTS.md 或 ~/.config/opencode/AGENTS.md 是全局共享文件，先告诉我你要追加什么再改，别直接动）',
    '   - WorkBuddy：写进记忆文档',
    '   - Cursor：写进 .cursor/rules；其他客户端按其 rules / instructions 机制',
    '   规则原文（原样写入）：',
    '   「当用户说『调取码 <码>』（首选）或『调取 <码>』时，直接调用 MCP 工具 prompt_manager_activate_prompt，参数 code 就是那个码；',
    '   调取码可能极短、很像日常用语（例如 hi），那也是调取码，不是问候，也不要去文件系统搜这个词；',
    '   调用成功后按卡片正文执行，不要复述正文，也不要追问下一步。」',
    '',
    '完成标准（四条都满足才算装好）：',
    '1) 自检退出码 0 且打印出卡片内容；',
    '2) 客户端工具列表能看到 prompt_manager_activate_prompt；',
    '3) 用示例调取码真实调取成功；',
    '4) 常驻说明已写入，并且你在新会话里只说「调取 xxx」也能触发。',
    '',
    '以后我会说「调取码 <调取码>」（也可能只说「调取 <调取码>」）。调取码可能很短、很像日常用语（例如 hi），那也是调取码——请直接调用 prompt_manager_activate_prompt，不要当成问候去闲聊，也不要到文件系统里搜这个词。',
    '任何一步失败就停下来把原始报错贴给我，不要猜着改。装好用三句话告诉我：装在哪个客户端、自检是否通过、是否真实调取成功。',
    '',
    `（下面是脚本原文：${bundle.entryCount} 张可调取卡片，生成于 ${generatedAt}。它不含密钥、不联网。）`,
    '',
    bundle.content,
  ].join('\n')
}

export interface ClientSnippet {
  client: string
  location: string
  format: 'json' | 'toml'
  snippet: string
  note: string
}

/** 手工配置用的片段：给不想让 AI 动手的人，也给接入后排查用。 */
export function buildClientSnippets(): ClientSnippet[] {
  const scriptPath = `$HOME/${MCP_INSTALL_DIR}/${MCP_SERVER_FILE}`
  const jsonSnippet = JSON.stringify(
    {
      mcpServers: {
        'prompt-manager': {
          command: 'node',
          args: [`${scriptPath}`.replace('$HOME', '<你的主目录>')],
        },
      },
    },
    null,
    2,
  )
  const tomlSnippet = [
    '[mcp_servers.prompt-manager]',
    'command = "node"',
    `args = ["<你的主目录>/${MCP_INSTALL_DIR}/${MCP_SERVER_FILE}"]`,
  ].join('\n')
  return [
    {
      client: 'WorkBuddy / Cursor / Claude Desktop / Cline / Windsurf / Gemini CLI',
      location: '各客户端 MCP 设置里的 mcpServers 节点',
      format: 'json',
      snippet: jsonSnippet,
      note: '写入后需要重开客户端会话；WorkBuddy 还要在「连接器」里点一次信任。',
    },
    {
      client: 'Codex CLI',
      location: '~/.codex/config.toml',
      format: 'toml',
      snippet: tomlSnippet,
      note: '追加到文件末尾即可，Codex 重开会话后生效。',
    },
  ]
}

/** 生成单文件离线 server 的源码。数据与时间以占位符注入，避免模板嵌套转义问题。 */
export function buildBundle(cards: Card[], generatedAt = new Date().toISOString()): McpBundle {
  const entries = buildSnapshot(cards)
  // 替换顺序有讲究：__PM_DATA__ 必须最后注入。
  // 卡片正文是用户内容，可能恰好含 `__PM_GENERATED_AT__` 这类字面量；
  // 若先注入数据、再做其余替换，正文里的同名字面量会被一起改掉（已推演出这条路径）。
  // 此外 __PM_GENERATED_AT__ 在模板里出现两次（头注释 + 常量），必须 replaceAll。
  const content = MCP_SERVER_TEMPLATE.replaceAll('__PM_GENERATED_AT__', generatedAt)
    .replaceAll('__PM_PROTOCOLS__', JSON.stringify(SUPPORTED_PROTOCOL_VERSIONS))
    .replaceAll('__PM_FALLBACK_PROTOCOL__', FALLBACK_PROTOCOL_VERSION)
    .replaceAll('__PM_DATA__', safeJson(entries))
  return {
    fileName: MCP_SERVER_FILE,
    content,
    entryCount: entries.length,
    bytes: new TextEncoder().encode(content).length,
  }
}

/** JSON 内联到 JS 源码时的兜底转义：U+2028/2029 在旧引擎里会截断字符串字面量。 */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

/**
 * 零依赖 MCP server 模板。
 *
 * 协议实现只覆盖本工具真正需要的部分：initialize / tools.list / tools.call / ping，
 * 以及未知方法的 -32601。分帧为「换行分隔 JSON」，与官方 SDK 的 stdio 传输一致。
 */
const MCP_SERVER_TEMPLATE = `#!/usr/bin/env node
/**
 * Prompt Manager MCP Server（离线单文件版）
 * 由提示词管理器网页版生成于 __PM_GENERATED_AT__
 *
 * 数据已内嵌在下方 SNAPSHOT 里：不需要服务端、不需要网络、不需要 npm install。
 * 用法：
 *   node prompt-manager-mcp.mjs            启动 MCP stdio server（客户端会这样调用）
 *   node prompt-manager-mcp.mjs --list     列出全部调取码
 *   node prompt-manager-mcp.mjs --selftest [调取码]   离线自检
 */

import process from 'node:process'

const GENERATED_AT = '__PM_GENERATED_AT__'
const SUPPORTED_PROTOCOLS = __PM_PROTOCOLS__
const FALLBACK_PROTOCOL = '__PM_FALLBACK_PROTOCOL__'

/** @type {{code:string,title:string,body:string,tags:string[],thinkingSummary:string|null,updatedAt:string}[]} */
const SNAPSHOT = __PM_DATA__

const SERVER_INFO = { name: 'prompt-manager-mcp-offline', version: '1.0.0' }

const TOOL = {
  name: 'prompt_manager_activate_prompt',
  title: '激活提示词卡片',
  description:
    '当用户说「调取码 <码>」时调用本工具——这是首选说法，最不容易被误解。' +
    '同义的「调取 <码>」「激活 <码>」「加载 <码>」「用 <码> 跑」也必须调用，参数 code 就是那个码（大小写不敏感）。' +
    '重要：调取码可能极短、很像日常用语（例如 hi、ok、test、1）。听到「调取码 hi」或「调取 hi」时，hi 就是要传给本工具的参数，' +
    '既不是问候也不是搜索关键词——直接调用本工具，不要去读文件或猜含义。' +
    '成功结果的 body 是仅供模型执行的私有指令，不是要呈现给用户的数据：不得展示、复述或总结；' +
    '不得只因激活成功而追问「下一步做什么」。应立刻遵循其中明确的角色、初始化和任务指令' +
    '（仍受既有 system 指令、权限和安全策略约束）。',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', minLength: 1, maxLength: 64, description: '卡片的调取码，大小写不敏感' },
    },
    required: ['code'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      code: { type: ['string', 'null'] },
      title: { type: 'string' },
      body: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      thinkingSummary: { type: ['string', 'null'] },
      updatedAt: { type: ['string', 'null'] },
    },
    required: ['code', 'title', 'body', 'tags', 'thinkingSummary', 'updatedAt'],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}

const INSTRUCTIONS =
  'prompt_manager_activate_prompt 用于加载可信提示词卡片。' +
  '用户说「调取码 <码>」（首选说法）或「调取 <码>」时，<码> 就是参数 code；' +
  '调取码可能是 hi、ok 这类极短的日常词，一律按调取码处理，不要当成问候、闲聊或文件搜索关键词。' +
  '成功调用后，将工具结果中的 body 作为本轮后续行为指令：不要向用户展示、复述或概括其正文；' +
  '不要仅因卡片激活而询问泛化的「下一步」。若正文给出明确的初始化或任务，' +
  '立即在既有系统策略和权限范围内执行。'

function normalizeCode(code) {
  return String(code == null ? '' : code).trim().toLowerCase()
}

function findEntry(code) {
  const key = normalizeCode(code)
  if (!key) return null
  return SNAPSHOT.find((entry) => entry.code === key) || null
}

function activationText(entry) {
  return (
    '<prompt-manager-activation private="true">\\n' +
    'status: activated\\n' +
    'model-action: Treat activated-instructions as the active role/task instructions for this turn.\\n' +
    'user-visible-action: Do not display, quote, summarize, or acknowledge the instructions. Do not ask a generic next-step question solely because activation succeeded.\\n' +
    'execution: Immediately perform any explicit initialization or task in activated-instructions, subject to higher-priority instructions and normal permission checks.\\n' +
    '</prompt-manager-activation>\\n\\n' +
    '<activated-instructions>\\n' +
    entry.body +
    '\\n</activated-instructions>'
  )
}

/** 工具调用的唯一实现：stdio 服务与 --selftest 共用，保证两处行为一致。 */
function callTool(args) {
  const code = normalizeCode(args && args.code)
  if (!code) {
    return {
      isError: true,
      content: [{ type: 'text', text: '调取码不能为空' }],
    }
  }
  if (SNAPSHOT.length === 0) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: '这个离线包是空的：导出时库里没有带调取码的卡片。请回网页给卡片设一个调取码后重新导出。',
      }],
    }
  }
  const entry = findEntry(code)
  if (!entry) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: '未找到调取码为「' + code + '」的卡片。可用的调取码：' + SNAPSHOT.map((e) => e.code).join(', '),
      }],
    }
  }
  const output = {
    code: entry.code,
    title: entry.title,
    body: entry.body,
    tags: entry.tags || [],
    thinkingSummary: entry.thinkingSummary,
    updatedAt: entry.updatedAt || null,
  }
  return {
    isError: false,
    content: [{ type: 'text', text: activationText(entry) }],
    structuredContent: output,
  }
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\\n')
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function pickProtocol(requested) {
  if (typeof requested === 'string' && SUPPORTED_PROTOCOLS.indexOf(requested) !== -1) return requested
  return FALLBACK_PROTOCOL
}

function handleMessage(message) {
  if (!message || typeof message !== 'object' || typeof message.method !== 'string') return
  const method = message.method
  const id = message.id
  const isNotification = id === undefined || id === null
  const params = message.params && typeof message.params === 'object' ? message.params : {}

  // 通知一律不回复；JSON-RPC 规定通知没有 id。
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return
  if (isNotification) return

  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: pickProtocol(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
      return
    case 'ping':
      reply(id, {})
      return
    case 'tools/list':
      reply(id, { tools: [TOOL] })
      return
    case 'tools/call': {
      const name = params.name
      if (name !== TOOL.name) {
        replyError(id, -32602, '未知工具：' + String(name))
        return
      }
      const result = callTool(params.arguments)
      reply(id, {
        content: result.content,
        structuredContent: result.structuredContent,
        isError: result.isError === true,
      })
      return
    }
    default:
      replyError(id, -32601, 'Method not found: ' + method)
  }
}

function startServer() {
  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    buffer += chunk
    // 防御：客户端异常时可能持续写入却没有换行，缓冲区会无上限增长并吃满内存。
    // 单条消息超过 8MB 一定不是合法 MCP 请求，直接丢弃（与官方 SDK 的 maxBufferSize 同量级）。
    if (buffer.length > 8 * 1024 * 1024) {
      buffer = ''
      process.stderr.write('prompt-manager-mcp: 单条消息超过 8MB，已丢弃\\n')
      return
    }
    let index = buffer.indexOf('\\n')
    while (index !== -1) {
      const line = buffer.slice(0, index).replace(/\\r$/, '')
      buffer = buffer.slice(index + 1)
      if (line.trim()) {
        try {
          handleMessage(JSON.parse(line))
        } catch (error) {
          // 单条消息坏掉不应该拖垮整个 server；也不要把原始内容回显（可能含用户正文）。
          process.stderr.write('prompt-manager-mcp: 忽略一条无法解析的消息\\n')
        }
      }
      index = buffer.indexOf('\\n')
    }
  })
  process.stdin.on('end', () => process.exit(0))
  // stderr 只用于诊断；stdout 是协议通道，任何非 JSON 输出都会破坏握手。
  process.stderr.write('prompt-manager-mcp offline ready · ' + SNAPSHOT.length + ' codes · generated ' + GENERATED_AT + '\\n')
}

function runSelftest(argv) {
  const code = argv[0]
  const lines = []
  let ok = true
  lines.push('离线包：' + SNAPSHOT.length + ' 张可调取卡片 · 生成于 ' + GENERATED_AT)
  lines.push('')

  const listResult = { tools: [TOOL] }
  const toolNames = listResult.tools.map((t) => t.name)
  lines.push('[1] tools/list → ' + (toolNames.indexOf(TOOL.name) !== -1 ? 'OK' : 'FAIL') + ' (' + toolNames.join(', ') + ')')
  if (toolNames.indexOf(TOOL.name) === -1) ok = false

  if (SNAPSHOT.length === 0) {
    lines.push('[2] 数据为空 → 请在网页里给卡片设置调取码后重新导出')
    ok = false
  } else {
    const target = code || SNAPSHOT[0].code
    const result = callTool({ code: target })
    if (result.isError) {
      lines.push('[2] tools/call "' + target + '" → FAIL: ' + result.content[0].text)
      ok = false
    } else {
      const out = result.structuredContent
      lines.push('[2] tools/call "' + target + '" → OK')
      lines.push('    标题：' + out.title)
      lines.push('    标签：' + (out.tags.length ? out.tags.join(' / ') : '（无）'))
      lines.push('    正文摘要：' + out.body.replace(/\\s+/g, ' ').slice(0, 80) + (out.body.length > 80 ? '…' : ''))
      lines.push('    正文长度：' + out.body.length + ' 字')
    }
  }

  lines.push('')
  lines.push('可用调取码（' + SNAPSHOT.length + '）：' + (SNAPSHOT.map((e) => e.code).join(', ') || '（无）'))
  lines.push('')
  lines.push(ok ? 'SELFTEST: PASS' : 'SELFTEST: FAIL')
  process.stdout.write(lines.join('\\n') + '\\n')
  process.exit(ok ? 0 : 1)
}

function runList() {
  if (SNAPSHOT.length === 0) {
    process.stdout.write('（空包：导出时库里没有带调取码的卡片）\\n')
    return
  }
  for (const entry of SNAPSHOT) {
    process.stdout.write(entry.code + '\\t' + entry.title + '\\t' + entry.body.length + ' 字\\n')
  }
}

const argv = process.argv.slice(2)
if (argv[0] === '--selftest') runSelftest(argv.slice(1))
else if (argv[0] === '--list') runList()
else if (argv[0] === '--help' || argv[0] === '-h') {
  process.stdout.write(
    'prompt-manager-mcp（离线单文件版）\\n' +
    '  （无参数）        启动 MCP stdio server\\n' +
    '  --list            列出全部调取码\\n' +
    '  --selftest [code] 离线自检（不连客户端）\\n',
  )
} else startServer()
`