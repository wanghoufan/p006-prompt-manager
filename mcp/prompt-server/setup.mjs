#!/usr/bin/env node
/**
 * 提示词管理器 · 一键接入
 *
 * 目标：让「接入」这件事只剩一条命令。
 * 用户把一句话发给自己的 AI，AI 执行本脚本，脚本负责：装依赖 → 构建 → 探测客户端 → 写配置 → 真调一次验证。
 *
 * 用法：
 *   node setup.mjs                     自动接入所有检测到的客户端
 *   node setup.mjs --dry-run           只看会做什么，不写任何文件
 *   node setup.mjs --check             只体检，不写配置
 *   node setup.mjs --client=codex      只接入指定客户端（可重复/逗号分隔）
 *   node setup.mjs --remove            卸载（从各客户端配置里移除）
 *   node setup.mjs --json              机器可读输出（给 AI 解析）
 *
 * 数据安全：本脚本只读提示词库（data/store.json）用于统计与验证，
 * 不修改任何卡片、标签或调取码。验证调用会把计数回调指向一个不可达端口，
 * 因此连「复制次数 +1」的副作用都不会发生。
 */

import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..', '..')
const HOME = os.homedir()
const SERVER_NAME = 'prompt-manager'
const ENTRY = join(HERE, 'dist', 'index.js')
const STORE = join(PROJECT_ROOT, 'data', 'store.json')
const TOOL_NAME = 'prompt_manager_activate_prompt'

/* ────────────────────────── 参数 ────────────────────────── */

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const optVal = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

const OPT = {
  dryRun: flag('dry-run'),
  check: flag('check'),
  remove: flag('remove'),
  json: flag('json'),
  help: flag('help') || argv.includes('-h'),
  verbose: flag('verbose'),
  only: (optVal('client') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}

/* ────────────────────────── 客户端定义 ────────────────────────── */

const appSupport = (...p) => join(HOME, 'Library', 'Application Support', ...p)

/**
 * 只有在「应用确实装了」或「配置文件已经存在」时才算检测到。
 * 只用目录存在来判断会误报——比如残留的空配置目录。
 */
const present = (...paths) => paths.some((p) => p && existsSync(p))

const CLIENTS = [
  {
    id: 'workbuddy',
    label: 'WorkBuddy',
    format: 'json',
    key: 'mcpServers',
    file: () => join(HOME, '.workbuddy', 'mcp.json'),
    detect: () => present('/Applications/WorkBuddy.app', join(HOME, '.workbuddy', 'mcp.json')),
    hint: '在 WorkBuddy 的「连接器」页面点一下“信任”，然后新开一个会话',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    format: 'toml',
    file: () => join(HOME, '.codex', 'config.toml'),
    detect: () => present('/Applications/ChatGPT.app', join(HOME, '.codex', 'config.toml')),
    hint: '新开一个 Codex 会话即可生效',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    format: 'json',
    key: 'mcpServers',
    file: () => join(HOME, '.cursor', 'mcp.json'),
    detect: () => present('/Applications/Cursor.app', join(HOME, '.cursor', 'mcp.json')),
    hint: '在 Settings → MCP 里确认开关打开，或重启 Cursor',
  },
  {
    id: 'claude',
    label: 'Claude Desktop',
    format: 'json',
    key: 'mcpServers',
    file: () => appSupport('Claude', 'claude_desktop_config.json'),
    detect: () => present('/Applications/Claude.app', appSupport('Claude', 'claude_desktop_config.json')),
    hint: '完全退出 Claude 再重新打开',
  },
  {
    id: 'cline',
    label: 'Cline（VS Code 插件）',
    format: 'json',
    key: 'mcpServers',
    file: () =>
      appSupport('Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    detect: () =>
      present(
        appSupport('Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      ),
    hint: '重启 VS Code',
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    format: 'json',
    key: 'mcpServers',
    file: () => join(HOME, '.codeium', 'windsurf', 'mcp_config.json'),
    detect: () => present('/Applications/Windsurf.app', join(HOME, '.codeium', 'windsurf', 'mcp_config.json')),
    hint: '重启 Windsurf',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    format: 'json',
    key: 'mcpServers',
    file: () => join(HOME, '.gemini', 'settings.json'),
    detect: () => present(join(HOME, '.gemini', 'settings.json')),
    hint: '重启 gemini 会话',
  },
]

/* ────────────────────────── 小工具 ────────────────────────── */

const log = (s = '') => {
  if (!OPT.json) process.stdout.write(s + '\n')
}
const tilde = (p) => (p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p)

function run(cmd, args, cwd, label) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.status !== 0) {
    const tail = ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-25).join('\n')
    throw new Error(`${label} 失败（退出码 ${r.status}）\n${tail}`)
  }
  return r.stdout || ''
}

function backup(file) {
  if (!existsSync(file)) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  // 同一秒内可能连续运行多次（如 --remove 后立刻重装），加序号避免备份互相覆盖
  let bak = `${file}.bak-${stamp}`
  let n = 1
  while (existsSync(bak)) bak = `${file}.bak-${stamp}-${++n}`
  copyFileSync(file, bak)
  return bak
}

/* ────────────────────────── 步骤 1：准备运行环境 ────────────────────────── */

function ensureBuild() {
  const steps = []

  if (!existsSync(join(HERE, 'node_modules', '@modelcontextprotocol'))) {
    if (OPT.dryRun || OPT.check) {
      steps.push('需要安装依赖：npm install（本次未执行）')
      return { ok: false, steps, nodeBin: process.execPath }
    }
    log('  安装依赖…')
    run('npm', ['install', '--no-audit', '--no-fund'], HERE, 'npm install')
    steps.push('已安装依赖')
  }

  const srcNewer =
    !existsSync(ENTRY) ||
    (() => {
      try {
        return statSync(join(HERE, 'src', 'index.ts')).mtimeMs > statSync(ENTRY).mtimeMs
      } catch {
        return true
      }
    })()

  if (srcNewer) {
    if (OPT.dryRun || OPT.check) {
      steps.push('需要构建：npm run build（本次未执行）')
      return { ok: false, steps, nodeBin: process.execPath }
    }
    log('  构建 MCP 服务…')
    run('npm', ['run', 'build'], HERE, 'npm run build')
    steps.push('已构建 dist/index.js')
  }

  if (!existsSync(ENTRY)) throw new Error('构建后仍未找到 dist/index.js')

  return { ok: true, steps, nodeBin: process.execPath }
}

/* ────────────────────────── 步骤 2：写入配置 ────────────────────────── */

const tomlStr = (s) => JSON.stringify(String(s))

function stripTomlSections(raw, prefix) {
  const out = []
  let skipping = false
  for (const line of raw.split('\n')) {
    const m = /^\s*\[([A-Za-z0-9_.\-"']+)\]\s*(#.*)?$/.exec(line)
    if (m) {
      const sec = m[1]
      skipping = sec === prefix || sec.startsWith(prefix + '.')
    }
    if (!skipping) out.push(line)
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop()
  return out
}

function writeJson(client, entry, remove) {
  const file = client.file()
  let data = {}
  if (existsSync(file)) {
    const raw = readFileSync(file, 'utf8').trim()
    if (raw) {
      try {
        data = JSON.parse(raw)
      } catch (e) {
        throw new Error(`${tilde(file)} 不是合法 JSON，已跳过以免破坏：${e.message}`)
      }
    }
  }
  if (!data[client.key] || typeof data[client.key] !== 'object') data[client.key] = {}

  if (remove) {
    const had = Boolean(data[client.key][SERVER_NAME])
    if (!had) return { changed: false, file }
    delete data[client.key][SERVER_NAME]
  } else {
    const prev = data[client.key][SERVER_NAME]
    const next = {
      command: entry.command,
      args: entry.args,
      description: '本地提示词管理库：用调取码把卡片激活为当前会话的角色 / 任务指令',
    }
    if (prev?.disabled === false) next.disabled = false
    if (prev && typeof prev === 'object' && !Array.isArray(prev)) {
      for (const [k, v] of Object.entries(prev)) {
        if (!(k in next)) next[k] = v
      }
    }
    if (JSON.stringify(prev) === JSON.stringify(next)) return { changed: false, file, upToDate: true }
    data[client.key][SERVER_NAME] = next
  }

  if (OPT.dryRun) return { changed: true, file, dryRun: true }

  const bak = backup(file)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return { changed: true, file, backup: bak }
}

function writeToml(client, entry, remove) {
  const file = client.file()
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const had = new RegExp(`^\\s*\\[mcp_servers\\.${SERVER_NAME}\\]`, 'm').test(raw)

  if (remove && !had) return { changed: false, file }

  let lines = stripTomlSections(raw, `mcp_servers.${SERVER_NAME}`)
  if (!remove) {
    lines.push(
      '',
      `[mcp_servers.${SERVER_NAME}]`,
      `command = ${tomlStr(entry.command)}`,
      `args = [${entry.args.map(tomlStr).join(', ')}]`,
      'enabled = true',
      '',
    )
  }
  const next = lines.join('\n').replace(/\n{3,}$/, '\n\n')

  if (!remove && next.trim() === raw.trim()) return { changed: false, file, upToDate: true }
  if (OPT.dryRun) return { changed: true, file, dryRun: true }

  const bak = backup(file)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, next.startsWith('\n') || next === '' ? next : next, 'utf8')
  return { changed: true, file, backup: bak }
}

/* ────────────────────────── 步骤 3：真调一次验证 ────────────────────────── */

function probe(entry, code) {
  return new Promise((done) => {
    const env = {
      ...process.env,
      // 指向不可达端口：命中卡片时的「复制次数 +1」回调会静默失败，不碰用户数据
      PROMPT_MANAGER_API_URL: 'http://127.0.0.1:9',
    }
    let child
    try {
      child = spawn(entry.command, entry.args, { stdio: ['pipe', 'pipe', 'pipe'], env })
    } catch (e) {
      return done({ ok: false, reason: 'spawn_failed', detail: e.message })
    }

    let buf = ''
    let err = ''
    let stage = 0
    let finished = false
    const msgs = []
    const timer = setTimeout(() => finish('timeout', '20 秒内没有收到完整响应'), 20000)

    const byId = (id) => msgs.find((m) => m.id === id)
    const send = (obj) => {
      try {
        child.stdin.write(JSON.stringify(obj) + '\n')
      } catch {}
    }

    function finish(reason, detail) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      try {
        child.kill()
      } catch {}
      const init = byId(1)
      const list = byId(2)
      const call = byId(3)
      const tools = Array.isArray(list?.result?.tools) ? list.result.tools : []
      done({
        ok: reason == null,
        reason: reason ?? null,
        detail: detail ?? null,
        serverInfo: init?.result?.serverInfo ?? null,
        tools: tools.map((t) => t.name),
        call: call
          ? {
              isError: Boolean(call.result?.isError),
              title: call.result?.structuredContent?.title ?? null,
              text: call.error?.message ?? call.result?.content?.[0]?.text ?? null,
            }
          : null,
        stderr: err.trim().slice(-500) || null,
      })
    }

    child.stdout.on('data', (d) => {
      buf += d.toString('utf8')
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line) continue
        try {
          msgs.push(JSON.parse(line))
        } catch {}
      }
      advance()
    })
    child.stderr.on('data', (d) => {
      err += d.toString('utf8')
    })
    child.on('error', (e) => finish('spawn_failed', e.message))
    child.on('exit', (c) => {
      if (!finished) finish('exited', `服务进程提前退出（code ${c}）`)
    })

    function advance() {
      if (finished) return
      if (stage === 0) {
        stage = 1
        send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'prompt-manager-setup', version: '1.0.0' },
          },
        })
        return
      }
      if (stage === 1 && byId(1)) {
        stage = 2
        send({ jsonrpc: '2.0', method: 'notifications/initialized' })
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
        return
      }
      if (stage === 2 && byId(2)) {
        if (!code) return finish(null)
        stage = 3
        send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: TOOL_NAME, arguments: { code } },
        })
        return
      }
      if (stage === 3 && byId(3)) return finish(null)
    }

    advance()
  })
}

/* ────────────────────────── 读取提示词库（只读） ────────────────────────── */

function peekStore() {
  try {
    const data = JSON.parse(readFileSync(STORE, 'utf8'))
    const cards = Array.isArray(data.cards) ? data.cards : []
    const codes = cards.map((c) => (c.code ?? '').trim()).filter(Boolean)
    return {
      exists: true,
      cards: cards.length,
      withCode: codes.length,
      probeCode: codes[0] ?? null,
    }
  } catch (e) {
    return { exists: existsSync(STORE), cards: 0, withCode: 0, probeCode: null, error: e.message }
  }
}

/* ────────────────────────── 主流程 ────────────────────────── */

function usage() {
  log(`提示词管理器 · 一键接入

  node ${'setup.mjs'} [选项]

  （无选项）     自动接入本机所有检测到的 AI 客户端
  --dry-run      只预览会做什么，不写文件
  --check        只体检（构建状态 + 配置状态 + 连通性），不写配置
  --client=<id>  只接入指定客户端，逗号分隔。可选：${CLIENTS.map((c) => c.id).join(', ')}
  --remove       从各客户端配置中移除
  --json         机器可读输出
  -h / --help    显示本帮助`)
}

async function main() {
  if (OPT.help) {
    usage()
    return { status: 'help' }
  }

  const store = peekStore()
  const result = {
    status: 'ok',
    action: OPT.remove ? 'remove' : OPT.check ? 'check' : OPT.dryRun ? 'dry-run' : 'install',
    projectRoot: PROJECT_ROOT,
    entry: ENTRY,
    store: { path: STORE, exists: store.exists, cards: store.cards, withCode: store.withCode },
    build: null,
    clients: [],
    verify: null,
    problems: [],
  }

  log('')
  log(OPT.remove ? '提示词管理器 · 卸载' : '提示词管理器 · 一键接入')
  log('─'.repeat(52))
  log('')

  /* 1. 构建 */
  log('[1/4] 检查运行环境')
  let build
  try {
    build = ensureBuild()
  } catch (e) {
    result.problems.push(e.message)
    result.build = { ok: false, error: e.message }
    log('  ✗ ' + e.message.split('\n')[0])
    emit(result)
    return result
  }
  const entry = { command: build.nodeBin, args: [ENTRY] }
  result.build = { ok: build.ok, node: entry.command, steps: build.steps }
  log(`  提示词库：${tilde(STORE)}（${store.cards} 张卡片，其中 ${store.withCode} 张已设调取码）`)
  log(`  运行文件：${tilde(ENTRY)}`)
  log(`  Node：${entry.command}`)
  if (!build.ok) result.problems.push(...build.steps)
  for (const s of build.steps) log('  · ' + s)

  if (!store.exists) {
    result.problems.push(`没找到 ${tilde(STORE)}。请先启动一次提示词管理器（npm run dev）并打开页面，数据会自动落盘。`)
  }

  /* 2. 探测客户端 */
  log('')
  log('[2/4] 检测本机 AI 客户端')
  let targets = CLIENTS.filter((c) => (OPT.only.length ? OPT.only.includes(c.id) : c.detect()))
  if (OPT.only.length) {
    const bad = OPT.only.filter((id) => !CLIENTS.some((c) => c.id === id))
    if (bad.length) result.problems.push(`未知客户端：${bad.join(', ')}`)
  }
  if (!targets.length) {
    log('  没有检测到支持 MCP 的客户端。')
    result.problems.push('没有检测到支持 MCP 的客户端，可手动运行 node setup.mjs --client=<id> 指定。')
  } else {
    log('  ' + targets.map((c) => c.label).join('、'))
  }

  /* 3. 写配置 */
  log('')
  log(OPT.remove ? '[3/4] 移除配置' : '[3/4] 写入配置')
  for (const c of targets) {
    const rec = { id: c.id, label: c.label, file: c.file(), changed: false, state: 'ok' }
    try {
      const r = OPT.check
        ? { changed: false, file: c.file() }
        : c.format === 'toml'
          ? writeToml(c, entry, OPT.remove)
          : writeJson(c, entry, OPT.remove)
      rec.changed = Boolean(r.changed)
      rec.backup = r.backup ? tilde(r.backup) : null
      if (OPT.check) rec.state = 'checked'
      else if (r.dryRun) rec.state = 'would-change'
      else if (r.upToDate) rec.state = 'up-to-date'
      else if (r.changed) rec.state = OPT.remove ? 'removed' : 'written'
      else rec.state = OPT.remove ? 'not-present' : 'unchanged'
      const mark =
        rec.state === 'ok' || rec.state === 'written' || rec.state === 'removed' || rec.state === 'up-to-date'
          ? '✓'
          : rec.state === 'would-change'
            ? '·'
            : '·'
      log(`  ${mark} ${c.label.padEnd(20)} ${tilde(rec.file)}${rec.backup ? `（已备份 ${rec.backup}）` : ''}`)
    } catch (e) {
      rec.state = 'error'
      rec.error = e.message
      result.problems.push(`${c.label}：${e.message}`)
      log(`  ✗ ${c.label.padEnd(20)} ${e.message}`)
    }
    result.clients.push(rec)
  }

  /* 4. 验证 */
  log('')
  log('[4/4] 实际调用验证')
  const p = await probe(entry, store.probeCode)
  result.verify = p
  if (p.ok) {
    log(`  ✓ 服务能启动，协议握手正常（${p.serverInfo?.name ?? 'prompt-manager'}）`)
    log(`  ✓ 工具已注册：${p.tools.join(', ')}`)
    if (p.call) {
      if (p.call.isError) {
        log(`  ✗ 调取失败：${p.call.text}`)
        result.problems.push(`调取验证失败：${p.call.text}`)
      } else {
        log(`  ✓ 实调「${store.probeCode}」成功，返回卡片《${p.call.title}》`)
        log('    （本次验证把计数回调指向了不可达端口，复制次数没有被改动）')
      }
    } else {
      log('  · 库里还没有设了调取码的卡片，跳过实调，只验证了工具注册')
    }
  } else {
    const why =
      p.reason === 'timeout'
        ? '20 秒内没响应'
        : p.reason === 'exited'
          ? '进程提前退出'
          : p.reason === 'spawn_failed'
            ? '启动失败'
            : p.reason
    log(`  ✗ 验证未通过：${why}${p.detail ? ' — ' + p.detail : ''}`)
    if (p.stderr) log('    服务端输出：' + p.stderr.split('\n')[0])
    result.problems.push(`验证未通过：${why}${p.detail ? ' — ' + p.detail : ''}`)
  }

  /* 结论 */
  result.status = result.problems.length ? (p.ok ? 'ok-with-warnings' : 'failed') : 'ok'
  if (result.status === 'failed' || result.status === 'ok-with-warnings') {
    log('')
    log('需要注意：')
    for (const m of result.problems) log('  ! ' + m)
  }

  emit(result)
  return result
}

function emit(result) {
  if (OPT.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }
  const done = result.clients.filter((c) => ['written', 'up-to-date', 'removed', 'checked'].includes(c.state))
  log('')
  log('─'.repeat(52))
  if (result.status === 'failed') {
    log('接入没有完成，请看上面的「需要注意」。')
  } else if (result.action === 'dry-run') {
    log('以上是预览，没有改动任何文件。去掉 --dry-run 就会真正写入。')
  } else if (result.action === 'check') {
    log('体检完成，没有改动任何文件。')
  } else if (result.action === 'remove') {
    log(`已从 ${done.length} 个客户端移除。重启客户端后彻底断开。`)
  } else {
    log(`已接入 ${done.length} 个客户端。`)
    const needAction = CLIENTS.filter((c) => done.some((d) => d.id === c.id) && c.hint)
    if (needAction.length) {
      log('')
      log('最后一步（每个客户端只做一次）：')
      for (const c of needAction) log(`  · ${c.label}：${c.hint}`)
    }
    log('')
    log('怎么用：在提示词管理器里给卡片设一个调取码，然后对 AI 说')
    log('「调取 <调取码>」，AI 就会加载那张卡片作为当前会话的角色 / 任务。')
  }
  log('')
}

main().catch((e) => {
  process.stderr.write('\n接入脚本出错：' + (e?.stack || e?.message || String(e)) + '\n')
  process.exitCode = 1
})
