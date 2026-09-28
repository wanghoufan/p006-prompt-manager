#!/usr/bin/env node
/**
 * 一次性导入脚本：把应用导出的 Markdown / JSON 备份写入本地 SQLite 主库。
 *
 * 数据源优先级与语义：
 * - Markdown（`# 提示词库备份`）：与应用「导入 Markdown」行为一致，版本历史为截断摘要不重建
 *   （除非 --import-version-snippets）；标签平铺（导出不含层级）。
 * - JSON（`{cards, settings}`）：保留 id 与完整 versions；标签同样平铺提取。
 *
 * 用法：
 *   node scripts/import-export-sqlite.mjs \
 *     --input scratch/prompt-manager-export-supabase-2026-09-28-120cards.md \
 *     [--db data/prompt-manager.db] [--import-version-snippets]
 *
 * 规则：本脚本只写 SQLite（开发/部署数据目录），不连 Supabase，不碰 .env，不入 Git。
 * 写入为全量覆写（与 /api/sync POST 的快照语义一致），执行前建议先备份现有库。
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DEFAULT_DB = path.join(PROJECT_ROOT, 'data', 'prompt-manager.db')

// ===================== args =====================
function parseArgs(argv) {
  const options = { input: null, db: DEFAULT_DB, importVersionSnippets: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      console.log(
        '用法：node scripts/import-export-sqlite.mjs --input <md|json> [--db <sqlite文件>] [--import-version-snippets]',
      )
      process.exit(0)
    }
    if (arg === '--input') { options.input = argv[++i]; continue }
    if (arg === '--db') { options.db = argv[++i]; continue }
    if (arg === '--import-version-snippets') { options.importVersionSnippets = true; continue }
    throw new Error(`未知参数 ${arg}`)
  }
  if (!options.input) throw new Error('--input 必填')
  return options
}

// ===================== Markdown 解析（与应用 storage.ts parseMarkdownImport 语义一致） =====================
const META_KEYS = new Set(['标签', '调取码', '来源链接', '评分', '复制次数', '创建时间', '更新时间'])

/**
 * 判定 `## N. 标题` 行是否为「真实卡片边界」而非正文内嵌小节标题。
 * 真实卡（buildMarkdownExport 输出）标题行后必跟一组 meta 行（- 标签：…/调取码/评分等 ≥2 个键）；
 * 正文内嵌的 `## N.` 小节后是普通正文行，不满足 meta 特征。
 */
function isCardBoundary(lines, index) {
  const keys = new Set()
  for (let j = index + 1; j < Math.min(lines.length, index + 10); j += 1) {
    const trimmed = lines[j].trim()
    if (!trimmed || trimmed === '---') continue
    if (/^#{2,4}\s/.test(trimmed)) break
    const meta = /^-\s+([^:：]+)[:：]\s*/.exec(trimmed)
    if (meta && META_KEYS.has(meta[1].trim())) {
      keys.add(meta[1].trim())
      if (keys.size >= 2) return true
    } else break
  }
  return false
}

function parseMarkdown(raw) {
  const lines = raw.split(/\r?\n/)
  if (!lines[0]?.trim().startsWith('# 提示词库备份')) return null
  const cards = []
  const skipped = []
  let current = null
  let section = null
  function flush() {
    if (!current) return
    const body = current.body.join('\n').replace(/\s+$/, '')
    if (!body.trim()) {
      skipped.push({ title: current.title || '(无标题)', reason: '正文为空' })
      current = null
      section = null
      return
    }
    cards.push({
      id: randomUUID(),
      title: current.title,
      body,
      tags: current.tags,
      code: current.code || null,
      rating: Math.max(0, Math.min(5, current.rating)),
      copyCount: Math.max(0, current.copyCount),
      thinkingSummary: current.summary ? current.summary.trim() : null,
      notes: current.notes,
      sourceUrl: current.sourceUrl,
      versions: [],
      createdAt: current.createdAt || new Date().toISOString(),
      updatedAt: current.updatedAt || new Date().toISOString(),
    })
    current = null
    section = null
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const cardMatch = /^##\s+\d+\.\s+(.+)$/.exec(line)
    if (cardMatch && isCardBoundary(lines, i)) {
      flush()
      current = { title: cardMatch[1].trim(), tags: [], rating: 0, copyCount: 0, code: null, createdAt: '', updatedAt: '', summary: null, notes: '', sourceUrl: '', body: [], versionSnippets: [] }
      section = 'meta'
      continue
    }
    if (!current) continue
    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) {
      const name = h3[1].trim()
      if (name === '正文') { section = 'body'; continue }
      // body 阶段未知 h3（如 ### Step 1）视为正文内容，防止正文被小节标题切断
      if (section === 'body') {
        if (name === '备注') { section = 'notes'; continue }
        if (name === '思维总结') { section = 'summary'; continue }
        if (name === '版本历史') { section = 'versions'; continue }
        current.body.push(line)
        continue
      }
      if (name === '备注') { section = 'notes'; continue }
      if (name === '思维总结') { section = 'summary'; continue }
      if (name === '版本历史') { section = 'versions'; continue }
      // meta 阶段未知 h3：忽略（非卡结构）
      continue
    }
    if (section === 'body') { current.body.push(line); continue }
    if (section === 'summary') { current.summary = (current.summary ?? '') + (current.summary ? '\n' : '') + line; continue }
    if (section === 'notes') { current.notes = current.notes + (current.notes ? '\n' : '') + line; continue }
    if (section === 'versions') {
      const m = /^-\s*(\S+)\s*[:：]\s*(.*)$/.exec(line)
      if (m) current.versionSnippets.push({ createdAt: m[1], body: m[2] })
      continue
    }
    if (section === 'meta') {
      const meta = /^-\s+([^:：]+)[:：]\s*(.*)$/.exec(line)
      if (!meta) continue
      const key = meta[1].trim()
      const value = meta[2].trim()
      if (key === '标签') current.tags = value.split(/[,，、]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10)
      else if (key === '调取码') current.code = value && value !== '（未设置）' ? value.trim().toLowerCase() : null
      else if (key === '来源链接') current.sourceUrl = value && value !== '（未设置）' ? value : ''
      else if (key === '评分') { const n = Number(value); if (!Number.isNaN(n)) current.rating = n }
      else if (key === '复制次数') { const n = Number(value); if (!Number.isNaN(n)) current.copyCount = n }
      else if (key === '创建时间') current.createdAt = value
      else if (key === '更新时间') current.updatedAt = value
    }
  }
  flush()
  return { cards, skipped }
}

// ===================== JSON 解析 =====================
function parseJsonBackup(raw) {
  const data = JSON.parse(raw)
  if (!data || typeof data !== 'object' || !Array.isArray(data.cards)) return null
  const cards = []
  const skipped = []
  for (const c of data.cards) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || typeof c.title !== 'string' || typeof c.body !== 'string') {
      skipped.push({ title: c?.title ?? '(无标题)', reason: '字段缺失/类型错误' })
      continue
    }
    cards.push({
      id: c.id,
      title: c.title,
      body: c.body,
      tags: Array.isArray(c.tags) ? c.tags.filter((t) => typeof t === 'string') : [],
      code: typeof c.code === 'string' && c.code ? c.code.toLowerCase() : null,
      rating: Number.isFinite(c.rating) ? Math.max(0, Math.min(5, c.rating)) : 0,
      copyCount: Number.isFinite(c.copyCount) ? Math.max(0, Math.floor(c.copyCount)) : 0,
      thinkingSummary: typeof c.thinkingSummary === 'string' ? c.thinkingSummary : (c.thinkingSummary ?? null),
      notes: typeof c.notes === 'string' ? c.notes : '',
      sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : '',
      versions: Array.isArray(c.versions)
        ? c.versions.filter((v) => v && typeof v === 'object' && typeof v.id === 'string' && typeof v.body === 'string')
            .map((v) => ({ id: v.id, body: v.body, createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString() }))
        : [],
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
      updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : new Date().toISOString(),
    })
  }
  const settings = data.settings && typeof data.settings === 'object' ? data.settings : null
  return { cards, skipped, settings }
}

// ===================== 标签平铺构建 =====================
function buildTags(cards, versionSnippetMode) {
  const tagByName = new Map()
  const tags = []
  const promptTags = []
  const now = new Date().toISOString()
  const taggedCards = 0
  for (const card of cards) {
    if (card.versionSnippets && versionSnippetMode) {
      for (const s of card.versionSnippets) {
        if (!s.body) continue
        card.versions.push({ id: randomUUID(), body: `[导出截断摘要] ${s.body}`, createdAt: s.createdAt })
      }
    }
     
    void taggedCards
    for (const name of card.tags) {
      const key = name.trim()
      if (!key) continue
      let tag = tagByName.get(key)
      if (!tag) {
        tag = { id: randomUUID(), name: key, parent_id: null, icon: null, is_pinned: false, sort_order: 0, created_at: now, updated_at: now }
        tagByName.set(key, tag)
        tags.push(tag)
      }
      promptTags.push({ prompt_id: card.id, tag_id: tag.id })
    }
  }
  return { tags, promptTags }
}

// ===================== settings 归一化（与应用 storage.ts normalizeSettings 一致） =====================
function normalizeSettings(source) {
  const s = source && typeof source === 'object' ? source : {}
  const DEFAULT_SETTINGS = {
    thinkingSummaryPrompt: '', confirmDelete: true, theme: 'system', autoFormatBody: false,
    bodyAlignment: 'left', composerAddMode: 'auto', hoverPreview: false,
    aiProvider: 'deepseek', aiModel: 'deepseek-v4-flash', aiBaseUrl: '',
  }
  const providers = ['deepseek', 'openrouter', 'opencode', 'opencode-go']
  const now = new Date().toISOString()
  return {
    thinking_summary_prompt: typeof s.thinkingSummaryPrompt === 'string' ? s.thinkingSummaryPrompt : DEFAULT_SETTINGS.thinkingSummaryPrompt,
    confirm_delete: typeof s.confirmDelete === 'boolean' ? (s.confirmDelete ? 1 : 0) : 1,
    theme: ['dark', 'light', 'system'].includes(s.theme) ? s.theme : 'system',
    auto_format_body: s.autoFormatBody ? 1 : 0,
    body_alignment: ['left', 'center', 'right'].includes(s.bodyAlignment) ? s.bodyAlignment : 'left',
    composer_add_mode: s.composerAddMode === 'manual' ? 'manual' : 'auto',
    hover_preview: s.hoverPreview ? 1 : 0,
    ai_provider: providers.includes(s.aiProvider) ? s.aiProvider : 'deepseek',
    ai_model: typeof s.aiModel === 'string' && s.aiModel ? s.aiModel : DEFAULT_SETTINGS.aiModel,
    ai_base_url: typeof s.aiBaseUrl === 'string' ? s.aiBaseUrl : '',
    revision: 1,
    created_at: now,
    updated_at: now,
  }
}

// ===================== SQLite 打开 + migrations（与 src/lib/db/sqlite.ts 逻辑对齐） =====================
function openDb(file) {
  mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       applied_at TEXT NOT NULL
     )`,
  )
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version))
  const migrationDir = path.join(PROJECT_ROOT, 'db', 'migrations')
  const files = readdirSync(migrationDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort()
  for (const file of files) {
    const version = Number(file.slice(0, file.indexOf('_')))
    if (applied.has(version)) continue
    const sql = readFileSync(path.join(migrationDir, file), 'utf8')
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(version, file, new Date().toISOString())
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Migration ${file} 执行失败：${error.message}`)
    }
  }
  return db
}

// ===================== 主流程 =====================
function main() {
  const options = parseArgs(process.argv.slice(2))
  console.log(`输入文件: ${options.input}`)
  console.log(`目标库:   ${options.db}`)

  const raw = readFileSync(options.input, 'utf8')
  let parsed = parseMarkdown(raw)
  let sourceKind = 'Markdown'
  if (!parsed) {
    const json = parseJsonBackup(raw)
    if (!json) throw new Error('输入既不是 Markdown 备份，也不是 JSON 备份')
    parsed = json
    sourceKind = 'JSON'
  }
  console.log(`数据源: ${sourceKind}`)
  console.log(`卡片数: ${parsed.cards.length}${parsed.skipped?.length ? `（跳过 ${parsed.skipped.length}：${parsed.skipped.map((s) => s.reason).join('；')}）` : ''}`)

  const { tags, promptTags } = buildTags(parsed.cards, options.importVersionSnippets)
  const codeSet = new Set()
  for (const card of parsed.cards) {
    if (!card.code) continue
    if (codeSet.has(card.code)) throw new Error(`调取码重复：${card.code}`)
    codeSet.add(card.code)
  }
  const tagNameSet = new Set(tags.map((t) => t.name))
  if (tagNameSet.size !== tags.length) throw new Error('平铺标签存在重名（与 CHECK 唯一约束冲突）')

  const db = openDb(options.db)
  // 全量覆写
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec('DELETE FROM prompt_tags')
    db.exec('DELETE FROM card_versions')
    db.exec('DELETE FROM cards')
    db.exec('UPDATE tags SET parent_id = NULL')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM settings WHERE id = 1')

    const insertTag = db.prepare('INSERT INTO tags (id, name, parent_id, icon, is_pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const tag of tags) insertTag.run(tag.id, tag.name, tag.parent_id, tag.icon, tag.is_pinned ? 1 : 0, tag.sort_order, tag.created_at, tag.updated_at)

    const insertCard = db.prepare('INSERT INTO cards (id, title, body, code, rating, copy_count, thinking_summary, notes, source_url, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
    const insertVersion = db.prepare('INSERT INTO card_versions (id, card_id, body, created_at) VALUES (?, ?, ?, ?)')
    const insertPromptTag = db.prepare('INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)')
    for (const card of parsed.cards) {
      insertCard.run(card.id, card.title, card.body, card.code, card.rating, card.copyCount, card.thinkingSummary, card.notes, card.sourceUrl, card.createdAt, card.updatedAt)
      for (const v of card.versions) insertVersion.run(v.id, card.id, v.body, v.createdAt)
    }
    for (const relation of promptTags) insertPromptTag.run(relation.prompt_id, relation.tag_id)

    const settings = normalizeSettings(parsed.settings)
    db.prepare('INSERT INTO settings (id, thinking_summary_prompt, confirm_delete, theme, auto_format_body, body_alignment, composer_add_mode, hover_preview, ai_provider, ai_model, ai_base_url, revision, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(settings.thinking_summary_prompt, settings.confirm_delete, settings.theme, settings.auto_format_body, settings.body_alignment, settings.composer_add_mode, settings.hover_preview, settings.ai_provider, settings.ai_model, settings.ai_base_url, settings.revision, settings.created_at, settings.updated_at)

    db.prepare("INSERT INTO meta (key, value) VALUES ('version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run()
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw new Error(`导入写入失败（已回滚）：${error.message}`)
  }

  // ===== 核对 =====
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all()
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n
  const reports = {
    完整性检查: integrity,
    外键违规: fkViolations.length,
    cards: count('cards'),
    card_versions: count('card_versions'),
    tags: count('tags'),
    prompt_tags: count('prompt_tags'),
    settings: count('settings'),
    mcp_access_tokens: count('mcp_access_tokens'),
  }
  console.log('\n===== 导入核对 =====')
  for (const [k, v] of Object.entries(reports)) console.log(`${k}: ${v}`)
  if (integrity !== 'ok' || fkViolations.length > 0) {
    console.error('导入后校验未通过，请勿使用该库！')
    process.exitCode = 1
  } else {
    console.log('导入校验通过。')
  }

  db.close()
  if (!existsSync(options.input)) console.warn('提示：输入文件已不存在（可能被移动）。')
}

try {
  main()
} catch (error) {
  console.error(`导入失败：${error.message}`)
  process.exitCode = 1
}