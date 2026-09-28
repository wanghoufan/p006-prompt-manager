import { EventEmitter } from 'events'
import type { Card, PromptTag, Settings, Tag, Version } from './types'
import { isTag, isPromptTag, validateTagGraph } from './tags'
import { getDb } from './db/sqlite'

// 服务端共享存储：SQLite 主库 + 内存版本号广播。
// 浏览器只通过 /api/sync 与 SSE 访问本模块；SQLite 文件位于 data/prompt-manager.db
// （生产 bind mount 到 DockerData，见 src/lib/db/sqlite.ts）。
// 变更通过 EventEmitter 广播版本号，由 SSE 推送给各客户端实现实时同步。
// 接口（getState/setState/subscribe/incrementCopy）与旧 JSON 版完全一致，
// /api/sync 协议（cards/settings/tags/promptTags/version + baseVersion 乐观并发）保持不变。

export interface ServerState {
  cards: unknown[]
  settings: unknown
  tags: unknown[]
  promptTags: unknown[]
  version: number
}

type CardRow = {
  id: string
  title: string
  body: string
  code: string | null
  rating: number
  copy_count: number
  thinking_summary: string | null
  notes: string
  source_url: string
  created_at: string
  updated_at: string
}

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

/** 清洗 settings，剥离 aiApiKey：密钥不落库（SQLite 列里也不存在该字段）。 */
function sanitizeSettings(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v
  const out: Record<string, unknown> = { ...(v as Record<string, unknown>) }
  delete out.aiApiKey
  return out
}

function readVersion(): number {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'version'").get() as { value: string } | undefined
  return row ? Number(row.value) : 1
}

function writeVersion(version: number): void {
  getDb()
    .prepare("INSERT INTO meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(String(version))
}

function toSettings(row: Record<string, unknown>): Settings {
  return {
    thinkingSummaryPrompt: String(row.thinking_summary_prompt ?? ''),
    confirmDelete: Boolean(row.confirm_delete),
    theme: (['dark', 'light', 'system'] as const).includes(row.theme as 'dark' | 'light' | 'system')
      ? (row.theme as Settings['theme'])
      : 'system',
    autoFormatBody: Boolean(row.auto_format_body),
    bodyAlignment: (['left', 'center', 'right'] as const).includes(row.body_alignment as 'left' | 'center' | 'right')
      ? (row.body_alignment as Settings['bodyAlignment'])
      : 'left',
    composerAddMode: row.composer_add_mode === 'manual' ? 'manual' : 'auto',
    // 缺列（异常库）时视为 true，与历史默认行为一致
    composerAutoTags: row.composer_auto_tags !== 0,
    composerAutoTitle: row.composer_auto_title !== 0,
    hoverPreview: Boolean(row.hover_preview),
    aiProvider: typeof row.ai_provider === 'string' ? (row.ai_provider as Settings['aiProvider']) : 'deepseek',
    aiModel: typeof row.ai_model === 'string' ? row.ai_model : 'deepseek-v4-flash',
    // 密钥从不落库；浏览器端 loadFromServer 会把本地 localStorage 的 aiApiKey 补回。
    aiApiKey: '',
    aiBaseUrl: typeof row.ai_base_url === 'string' ? row.ai_base_url : '',
  }
}

/** 从 SQLite 读取完整快照（cards 含 tags 名称数组与 versions；settings 单行）。 */
function readStoreSnapshot(): ServerState {
  const db = getDb()
  const tagRows = db.prepare('SELECT * FROM tags').all() as Array<{
    id: string; name: string; parent_id: string | null; icon: string | null
    is_pinned: number; sort_order: number; created_at: string; updated_at: string
  }>
  const tags: Tag[] = tagRows.map((r) => ({
    id: r.id, name: r.name, parent_id: r.parent_id, icon: r.icon,
    is_pinned: r.is_pinned === 1, sort_order: r.sort_order,
    created_at: r.created_at, updated_at: r.updated_at,
  }))
  const promptTags = db.prepare('SELECT prompt_id, tag_id FROM prompt_tags').all() as unknown as PromptTag[]
  const cardRows = db.prepare('SELECT * FROM cards ORDER BY updated_at DESC').all() as CardRow[]
  const versionRows = db
    .prepare('SELECT id, card_id, body, created_at FROM card_versions ORDER BY created_at DESC')
    .all() as Array<{ id: string; card_id: string; body: string; created_at: string }>
  const settingsRow = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined

  const versionsByCard = new Map<string, Version[]>()
  for (const row of versionRows) {
    const list = versionsByCard.get(row.card_id) ?? []
    list.push({ id: row.id, body: row.body, createdAt: row.created_at })
    versionsByCard.set(row.card_id, list)
  }

  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const tagNamesByCard = new Map<string, string[]>()
  for (const relation of promptTags) {
    const name = tagNameById.get(relation.tag_id)
    if (!name) continue
    const list = tagNamesByCard.get(relation.prompt_id) ?? []
    list.push(name)
    tagNamesByCard.set(relation.prompt_id, list)
  }
  for (const names of tagNamesByCard.values()) names.sort((a, b) => a.localeCompare(b))

  const cards: Card[] = cardRows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    tags: tagNamesByCard.get(row.id) ?? [],
    code: row.code,
    rating: row.rating,
    copyCount: row.copy_count,
    thinkingSummary: row.thinking_summary,
    notes: row.notes,
    sourceUrl: row.source_url,
    versions: versionsByCard.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return {
    cards,
    settings: settingsRow ? toSettings(settingsRow) : null,
    tags,
    promptTags,
    version: readVersion(),
  }
}

export async function getState(): Promise<ServerState> {
  const snapshot = readStoreSnapshot()
  // settings 二次清洗，杜绝历史残留 Key 外泄
  return { ...snapshot, settings: sanitizeSettings(snapshot.settings) }
}

/** setState 的返回：成功返回新版本号；校验/版本冲突返回错误对象（由 /api/sync 透传）。 */
export type SetStateResult = number | { ok: false; error: string; conflict?: boolean }

export async function setState(next: {
  cards: unknown[]
  settings: unknown
  tags?: unknown[]
  promptTags?: unknown[]
  /** P0-A 版本号提交：客户端声明本次写入基于的版本；已变化则拒绝并刷新后重试 */
  baseVersion?: number
}): Promise<SetStateResult> {
  const db = getDb()
  const current = readStoreSnapshot()
  const nextTags = Array.isArray(next.tags) ? (next.tags.filter(isTag) as Tag[]) : (current.tags as Tag[])
  const nextPromptTags = Array.isArray(next.promptTags)
    ? (next.promptTags.filter(isPromptTag) as PromptTag[])
    : (current.promptTags as PromptTag[])
  const nextSettings = sanitizeSettings(next.settings)

  // P0-A 服务端写入前校验：父级存在 / 无环 / 同父无重名 / 关联不悬空 / (prompt_id, tag_id) 唯一。
  const cardIds = new Set<string>()
  for (const c of next.cards) {
    if (c && typeof c === 'object') {
      const id = (c as Record<string, unknown>).id
      if (typeof id === 'string') cardIds.add(id)
    }
  }
  const invalid = validateTagGraph(nextTags, nextPromptTags, cardIds)
  if (invalid) {
    return { ok: false, error: `数据校验失败：${invalid}` }
  }

  const currentSerialized = JSON.stringify({
    cards: current.cards,
    settings: current.settings,
    tags: current.tags,
    promptTags: current.promptTags,
  })
  const incomingSerialized = JSON.stringify({
    cards: next.cards,
    settings: nextSettings,
    tags: nextTags,
    promptTags: nextPromptTags,
  })
  if (currentSerialized === incomingSerialized) {
    // 内容无变化：保持版本号、不落盘、不广播，避免远程回写导致的推送死循环
    return current.version
  }
  if (typeof next.baseVersion === 'number' && next.baseVersion !== current.version) {
    return {
      ok: false,
      error: `版本已变化（当前 ${current.version}，提交基于 ${next.baseVersion}），请刷新后重试`,
      conflict: true,
    }
  }

  const newVersion = current.version + 1
  db.exec('BEGIN IMMEDIATE')
  try {
    // 全量快照覆写：先清旧关系/版本/卡片/设置，再重建（快照内 validateTagGraph 已保证引用合法）。
    db.exec('DELETE FROM prompt_tags')
    db.exec('DELETE FROM card_versions')
    db.exec('DELETE FROM cards')
    db.exec('UPDATE tags SET parent_id = NULL')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM settings WHERE id = 1')

    const insertTag = db.prepare(
      `INSERT INTO tags (id, name, parent_id, icon, is_pinned, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const tag of nextTags) {
      insertTag.run(
        tag.id,
        tag.name,
        tag.parent_id,
        tag.icon ?? null,
        tag.is_pinned ? 1 : 0,
        tag.sort_order ?? 0,
        tag.created_at,
        tag.updated_at,
      )
    }

    const insertCard = db.prepare(
      `INSERT INTO cards (id, title, body, code, rating, copy_count, thinking_summary, notes, source_url, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    const insertVersion = db.prepare(
      `INSERT INTO card_versions (id, card_id, body, created_at) VALUES (?, ?, ?, ?)`,
    )
    const insertPromptTag = db.prepare(`INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)`)
    for (const raw of next.cards) {
      const card = raw as Card
      insertCard.run(
        card.id,
        card.title,
        card.body,
        card.code || null,
        card.rating ?? 0,
        card.copyCount ?? 0,
        card.thinkingSummary ?? null,
        card.notes ?? '',
        card.sourceUrl ?? '',
        card.createdAt,
        card.updatedAt,
      )
      for (const version of card.versions ?? []) {
        insertVersion.run(version.id, card.id, version.body, version.createdAt)
      }
    }
    for (const relation of nextPromptTags) {
      insertPromptTag.run(relation.prompt_id, relation.tag_id)
    }

    const row = settingsToRow(nextSettings)
    if (row) {
      db.prepare(
        `INSERT INTO settings (
           id, thinking_summary_prompt, confirm_delete, theme, auto_format_body, body_alignment,
           composer_add_mode, composer_auto_tags, composer_auto_title, hover_preview,
           ai_provider, ai_model, ai_base_url, revision, created_at, updated_at
         ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(
        row.thinking_summary_prompt,
        row.confirm_delete ? 1 : 0,
        row.theme,
        row.auto_format_body ? 1 : 0,
        row.body_alignment,
        row.composer_add_mode,
        row.composer_auto_tags ? 1 : 0,
        row.composer_auto_title ? 1 : 0,
        row.hover_preview ? 1 : 0,
        row.ai_provider,
        row.ai_model,
        row.ai_base_url,
        row.created_at,
        row.updated_at,
      )
    }

    writeVersion(newVersion)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    console.error('[serverStore] SQLite 写入失败:', error)
    return { ok: false, error: `数据库写入失败：${error instanceof Error ? error.message : String(error)}` }
  }

  emitter.emit('change', newVersion)
  return newVersion
}

function settingsToRow(settings: unknown): {
  thinking_summary_prompt: string
  confirm_delete: boolean
  theme: string
  auto_format_body: boolean
  body_alignment: string
  composer_add_mode: string
  composer_auto_tags: boolean
  composer_auto_title: boolean
  hover_preview: boolean
  ai_provider: string
  ai_model: string
  ai_base_url: string
  created_at: string
  updated_at: string
} | null {
  if (!settings || typeof settings !== 'object') return null
  const s = settings as Record<string, unknown>
  const now = new Date().toISOString()
  return {
    thinking_summary_prompt: typeof s.thinkingSummaryPrompt === 'string' ? s.thinkingSummaryPrompt : '',
    confirm_delete: s.confirmDelete !== false,
    theme: ['dark', 'light', 'system'].includes(s.theme as string) ? (s.theme as string) : 'system',
    auto_format_body: s.autoFormatBody === true,
    body_alignment: ['left', 'center', 'right'].includes(s.bodyAlignment as string)
      ? (s.bodyAlignment as string)
      : 'left',
    composer_add_mode: s.composerAddMode === 'manual' ? 'manual' : 'auto',
    composer_auto_tags: s.composerAutoTags !== false,
    composer_auto_title: s.composerAutoTitle !== false,
    hover_preview: s.hoverPreview === true,
    ai_provider: typeof s.aiProvider === 'string' ? s.aiProvider : 'deepseek',
    ai_model: typeof s.aiModel === 'string' ? s.aiModel : 'deepseek-v4-flash',
    ai_base_url: typeof s.aiBaseUrl === 'string' ? s.aiBaseUrl : '',
    created_at: now,
    updated_at: now,
  }
}

export function subscribe(cb: (version: number) => void): () => void {
  emitter.on('change', cb)
  return () => emitter.off('change', cb)
}

/**
 * 按调取码给卡片复制次数 +1（供 MCP 调用时计数，与手动复制共用 copyCount）。
 * 找到卡片返回新的 copyCount；未找到返回 null。
 * 会 bump 版本号并广播 SSE，其他端实时刷新。
 */
export async function incrementCopy(code: string): Promise<number | null> {
  const db = getDb()
  const key = code.trim().toLowerCase()
  if (!key) return null
  const row = db
    .prepare('SELECT id, copy_count FROM cards WHERE lower(code) = ?')
    .get(key) as { id: string; copy_count: number } | undefined
  if (!row) return null
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('UPDATE cards SET copy_count = copy_count + 1 WHERE id = ?').run(row.id)
    const version = readVersion() + 1
    writeVersion(version)
    db.exec('COMMIT')
    emitter.emit('change', version)
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return row.copy_count + 1
}
/**
 * 按调取码激活卡片（MCP 专用链路）：copy_count +1、revision +1、updated_at 刷新，并广播版本。
 * 不校验令牌——令牌校验由 /api/mcp/activate route 负责（校验通过后才调用本函数）。
 * 找到卡片返回 {code,title,body,tags,thinkingSummary,updatedAt,copyCount}；未找到返回 null。
 */
export async function activatePromptByCode(code: string): Promise<{
  code: string | null
  title: string
  body: string
  tags: string[]
  thinkingSummary: string | null
  updatedAt: string
  copyCount: number
} | null> {
  const db = getDb()
  const key = code.trim().toLowerCase()
  if (!key) return null
  const card = db.prepare('SELECT * FROM cards WHERE lower(code) = ?').get(key) as CardRow | undefined
  if (!card) return null
  const tagRows = db
    .prepare(
      `SELECT t.name AS name FROM prompt_tags pt
       JOIN tags t ON t.id = pt.tag_id
       WHERE pt.prompt_id = ? ORDER BY t.name`,
    )
    .all(card.id) as Array<{ name: string }>
  const now = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('UPDATE cards SET copy_count = copy_count + 1, revision = revision + 1, updated_at = ? WHERE id = ?').run(now, card.id)
    const version = readVersion() + 1
    writeVersion(version)
    db.exec('COMMIT')
    emitter.emit('change', version)
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return {
    code: card.code,
    title: card.title,
    body: card.body,
    tags: tagRows.map((row) => row.name),
    thinkingSummary: card.thinking_summary,
    updatedAt: now,
    copyCount: card.copy_count + 1,
  }
}