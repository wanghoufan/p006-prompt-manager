'use client'

import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Card, PromptTag, Settings, Tag, Version } from '@/lib/types'
import { getSupabaseBrowserClient } from './browser'
import { PROMPT_MANAGER_SCHEMA } from './config'

/**
 * Supabase 中的业务字段使用 snake_case；页面仍继续使用已有的 camelCase 类型。
 * 这个文件是两种表示之间唯一的转换边界，避免把数据库细节散落进组件。
 */
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

type CardVersionRow = {
  id: string
  card_id: string
  body: string
  created_at: string
}

type TagRow = {
  id: string
  name: string
  parent_id: string | null
  icon: string | null
  is_pinned: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

type PromptTagRow = {
  prompt_id: string
  tag_id: string
}

type SettingsRow = {
  thinking_summary_prompt: string
  confirm_delete: boolean
  theme: Settings['theme']
  auto_format_body: boolean
  body_alignment: Settings['bodyAlignment']
  composer_add_mode: Settings['composerAddMode']
  hover_preview: boolean
  ai_provider: Settings['aiProvider']
  ai_model: string
  ai_base_url: string
}

export type PromptCloudSnapshot = {
  cards: Card[]
  settings: Settings | null
  tags: Tag[]
  promptTags: PromptTag[]
  /** 云端是否已有任何业务记录；空库时绝不能据此覆盖本地数据。 */
  hasCloudData: boolean
}

export type PromptMutationResult =
  | { ok: true }
  | { ok: false; kind: 'unavailable' | 'conflict' | 'error'; message: string }

export async function getPromptCloudUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  return error || !data.user ? null : data.user.id
}

export type PromptCloudSessionUser = { signedIn: boolean; userId: string | null }

/**
 * 连接前的登录态探测：本地已有会话即视为已登录。
 * `getUser` 需要访问网络，令牌刷新遇到瞬时故障时只说明「云端暂不可用」，
 * 不代表用户已退出；只有本地完全没有会话时才用 `getUser` 再确认一次。
 */
export async function getPromptCloudSessionUser(): Promise<PromptCloudSessionUser> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { signedIn: false, userId: null }
  const { data: sessionData } = await supabase.auth.getSession()
  const sessionUser = sessionData.session?.user ?? null
  if (sessionUser) return { signedIn: true, userId: sessionUser.id }
  const { data, error } = await supabase.auth.getUser()
  return { signedIn: !error && !!data.user, userId: data.user?.id ?? null }
}

function throwQueryError(scope: string, error: { message: string } | null) {
  if (error) throw new Error(`${scope}：${error.message}`)
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    icon: row.icon,
    is_pinned: row.is_pinned,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function toSettings(row: SettingsRow, localAiApiKey: string): Settings {
  return {
    thinkingSummaryPrompt: row.thinking_summary_prompt,
    confirmDelete: row.confirm_delete,
    theme: row.theme,
    autoFormatBody: row.auto_format_body,
    bodyAlignment: row.body_alignment,
    composerAddMode: row.composer_add_mode,
    hoverPreview: row.hover_preview,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    // 密钥从不落入 Supabase：只保留当前浏览器已有的本地值。
    aiApiKey: localAiApiKey,
    aiBaseUrl: row.ai_base_url,
  }
}

function toCards(rows: CardRow[], versions: CardVersionRow[], promptTags: PromptTagRow[], tags: Tag[]): Card[] {
  const versionsByCard = new Map<string, Version[]>()
  for (const version of versions) {
    const list = versionsByCard.get(version.card_id) ?? []
    list.push({ id: version.id, body: version.body, createdAt: version.created_at })
    versionsByCard.set(version.card_id, list)
  }

  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const tagNamesByCard = new Map<string, string[]>()
  for (const relation of promptTags) {
    const tagName = tagNameById.get(relation.tag_id)
    if (!tagName) continue
    const list = tagNamesByCard.get(relation.prompt_id) ?? []
    list.push(tagName)
    tagNamesByCard.set(relation.prompt_id, list)
  }

  return rows.map((row) => ({
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
}

/**
 * 读取当前登录用户在 `prompt_manager` schema 中的完整提示词快照。
 * 返回 null 仅表示浏览器未配置 Supabase 客户端；登录态校验失败或查询失败一律抛出，
 * 由调用者保持在云端模式重试。空库返回 `hasCloudData: false`，
 * 由调用者保留本地数据并等待用户显式确认导入。
 */
export async function loadPromptCloudSnapshot(localAiApiKey: string): Promise<PromptCloudSnapshot | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null

  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) {
    // 与「空库」严格区分：登录态校验失败属于读取失败，必须让调用方保持在云端模式重试，
    // 绝不能被当作未登录 / 空库而静默降级到其他数据源。
    throw new Error(authError?.message ?? '云端登录状态校验失败')
  }

  const database = supabase.schema(PROMPT_MANAGER_SCHEMA)
  const [cardsResult, versionsResult, tagsResult, promptTagsResult, settingsResult] = await Promise.all([
    database.from('cards').select('id,title,body,code,rating,copy_count,thinking_summary,notes,source_url,created_at,updated_at').order('updated_at', { ascending: false }),
    database.from('card_versions').select('id,card_id,body,created_at').order('created_at', { ascending: false }),
    database.from('tags').select('id,name,parent_id,icon,is_pinned,sort_order,created_at,updated_at').order('sort_order', { ascending: true }),
    database.from('prompt_tags').select('prompt_id,tag_id'),
    database.from('settings').select('thinking_summary_prompt,confirm_delete,theme,auto_format_body,body_alignment,composer_add_mode,hover_preview,ai_provider,ai_model,ai_base_url').maybeSingle(),
  ])

  throwQueryError('读取云端卡片失败', cardsResult.error)
  throwQueryError('读取云端历史版本失败', versionsResult.error)
  throwQueryError('读取云端标签失败', tagsResult.error)
  throwQueryError('读取云端标签关联失败', promptTagsResult.error)
  throwQueryError('读取云端设置失败', settingsResult.error)

  const tags = ((tagsResult.data ?? []) as TagRow[]).map(toTag)
  const promptTags = (promptTagsResult.data ?? []) as PromptTagRow[]
  const cards = toCards(
    (cardsResult.data ?? []) as CardRow[],
    (versionsResult.data ?? []) as CardVersionRow[],
    promptTags,
    tags,
  )
  const settings = settingsResult.data
    ? toSettings(settingsResult.data as SettingsRow, localAiApiKey)
    : null

  return {
    cards,
    settings,
    tags,
    promptTags,
    hasCloudData: cards.length > 0 || tags.length > 0 || settings !== null,
  }
}

/** 监听其他设备对云端记录的变更；回调只提示调用方重新读取，不接受不完整的事件 payload。 */
export function subscribeToPromptCloudChanges(onChange: () => void): () => void {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return () => {}

  let channel: RealtimeChannel | null = supabase.channel('prompt-manager-cloud-sync')
  for (const table of ['cards', 'card_versions', 'tags', 'prompt_tags', 'settings']) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: PROMPT_MANAGER_SCHEMA, table },
      onChange,
    )
  }
  channel.subscribe()

  return () => {
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }
}

function unavailable(): PromptMutationResult {
  return { ok: false, kind: 'unavailable', message: '请先登录云端后再同步修改' }
}

function failure(error: { message: string } | null): PromptMutationResult {
  return { ok: false, kind: 'error', message: error?.message ?? '云端保存失败' }
}

async function revisionedSave(
  table: 'cards' | 'tags' | 'settings',
  idColumn: 'id' | 'owner_user_id',
  id: string,
  payload: Record<string, unknown>,
): Promise<PromptMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable()
  const database = supabase.schema(PROMPT_MANAGER_SCHEMA)
  const { data: existing, error: readError } = await database
    .from(table)
    .select('revision')
    .eq(idColumn, id)
    .maybeSingle()
  if (readError) return failure(readError)

  if (!existing) {
    const { error } = await database.from(table).insert(payload)
    return error ? failure(error) : { ok: true }
  }

  const revision = Number((existing as { revision: number }).revision)
  const { data, error } = await database
    .from(table)
    .update({ ...payload, revision: revision + 1 })
    .eq(idColumn, id)
    .eq('revision', revision)
    .select('revision')
    .maybeSingle()
  if (error) return failure(error)
  if (!data) return { ok: false, kind: 'conflict', message: '这条内容已在另一台设备更新，请刷新后再修改' }
  return { ok: true }
}

/** 逐条保存卡片；标签关系和历史版本由专门函数维护，避免隐式整库覆盖。 */
export function savePromptCard(card: Card): Promise<PromptMutationResult> {
  return revisionedSave('cards', 'id', card.id, {
    id: card.id,
    title: card.title,
    body: card.body,
    code: card.code,
    rating: card.rating,
    copy_count: card.copyCount,
    thinking_summary: card.thinkingSummary,
    notes: card.notes,
    source_url: card.sourceUrl,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  })
}

export function savePromptTag(tag: Tag): Promise<PromptMutationResult> {
  return revisionedSave('tags', 'id', tag.id, {
    id: tag.id,
    name: tag.name,
    parent_id: tag.parent_id,
    icon: tag.icon,
    is_pinned: tag.is_pinned,
    sort_order: tag.sort_order,
    created_at: tag.created_at,
    updated_at: tag.updated_at,
  })
}

/** `aiApiKey` 不属于云端 payload；调用者传入的本机密钥会被忽略。 */
export function savePromptSettings(settings: Settings, ownerUserId: string): Promise<PromptMutationResult> {
  return revisionedSave('settings', 'owner_user_id', ownerUserId, {
    owner_user_id: ownerUserId,
    thinking_summary_prompt: settings.thinkingSummaryPrompt,
    confirm_delete: settings.confirmDelete,
    theme: settings.theme,
    auto_format_body: settings.autoFormatBody,
    body_alignment: settings.bodyAlignment,
    composer_add_mode: settings.composerAddMode,
    hover_preview: settings.hoverPreview,
    ai_provider: settings.aiProvider,
    ai_model: settings.aiModel,
    ai_base_url: settings.aiBaseUrl,
  })
}

export async function deletePromptCard(cardId: string): Promise<PromptMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable()
  const { error } = await supabase.schema(PROMPT_MANAGER_SCHEMA).from('cards').delete().eq('id', cardId)
  return error ? failure(error) : { ok: true }
}

export async function deletePromptTag(tagId: string): Promise<PromptMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable()
  const { error } = await supabase.schema(PROMPT_MANAGER_SCHEMA).from('tags').delete().eq('id', tagId)
  return error ? failure(error) : { ok: true }
}

/**
 * 将某卡片的标签关系增量同步到云端。
 *
 * 先补新增关系、再删已移除关系，网络中断时最多留下额外关系，不会把已有
 * 关联先整体删除而造成数据丢失。`prompt_tags` 的复合主键会继续兜底去重。
 */
export async function syncPromptCardTags(
  cardId: string,
  previousTagIds: string[],
  nextTagIds: string[],
): Promise<PromptMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable()
  // 显式归属：插入时带上当前 uid，不依赖服务端 default，避免失效会话/跨用户时 FK 对不上。
  const { data: auth, error: authError } = await supabase.auth.getUser()
  const userId = auth.user?.id ?? null
  if (authError || !userId) return unavailable()
  const database = supabase.schema(PROMPT_MANAGER_SCHEMA)
  const table = database.from('prompt_tags')
  const previous = new Set(previousTagIds)
  const next = new Set(nextTagIds)
  const additions = [...next].filter((tagId) => !previous.has(tagId))
  const removals = [...previous].filter((tagId) => !next.has(tagId))

  if (additions.length > 0) {
    // 父行存在性预检：卡片/标签父行尚未同步到云端时返回可读错误，
    // 调用方 retryCloudSync 下轮重试，而不是抛出 FK 裸错。
    const { data: parentCard, error: cardError } = await database
      .from('cards')
      .select('id')
      .eq('id', cardId)
      .maybeSingle()
    if (cardError) return failure(cardError)
    if (!parentCard) {
      return { ok: false, kind: 'error', message: '卡片尚未同步到云端，标签关联稍后重试' }
    }
    const { data: parentTags, error: tagsError } = await database
      .from('tags')
      .select('id')
      .in('id', additions)
    if (tagsError) return failure(tagsError)
    const foundTagIds = new Set(((parentTags ?? []) as { id: string }[]).map((row) => row.id))
    if (additions.some((tagId) => !foundTagIds.has(tagId))) {
      return { ok: false, kind: 'error', message: '标签尚未同步到云端，标签关联稍后重试' }
    }
    const { error } = await table.upsert(
      additions.map((tag_id) => ({ prompt_id: cardId, tag_id, owner_user_id: userId })),
      { onConflict: 'prompt_id,tag_id', ignoreDuplicates: true },
    )
    if (error) return failure(error)
  }

  if (removals.length > 0) {
    const { error } = await table.delete().eq('prompt_id', cardId).in('tag_id', removals)
    if (error) return failure(error)
  }

  return { ok: true }
}

export async function replacePromptCardVersions(card: Card): Promise<PromptMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable()
  const table = supabase.schema(PROMPT_MANAGER_SCHEMA).from('card_versions')
  if (card.versions.length === 0) return { ok: true }
  // 历史版本是追加式审计记录：只补齐缺失版本，绝不先删后写，避免网络中断时丢历史。
  const { error } = await table.upsert(card.versions.map((version) => ({
    id: version.id, card_id: card.id, body: version.body, created_at: version.createdAt,
  })), { onConflict: 'id', ignoreDuplicates: true })
  return error ? failure(error) : { ok: true }
}
