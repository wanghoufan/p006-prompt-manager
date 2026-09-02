#!/usr/bin/env node

/**
 * 将现有 data/store.json 转为 prompt_manager Schema 的审查用导入包。
 *
 * 此工具绝不连接 Supabase、绝不读取 .env，也不会提交或上传真实数据。
 * 使用方式（在取得 Supabase Auth 用户 UUID 后）：
 *   node scripts/export-supabase-import.mjs \
 *     --owner <auth-user-uuid> \
 *     --input data/store.json \
 *     --out scratch/supabase-import-YYYYMMDD
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fail(message) {
  console.error(`导入包生成失败：${message}`)
  process.exitCode = 1
}

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      console.log('用法：node scripts/export-supabase-import.mjs --owner <uuid> --input <store.json> --out <目录>')
      process.exit(0)
    }
    if (!['--owner', '--input', '--out'].includes(arg)) {
      throw new Error(`未知参数 ${arg}`)
    }
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`${arg} 缺少值`)
    options[arg.slice(2)] = value
    i += 1
  }
  return options
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} 不是数组`)
  return value
}

function asString(value, field, fallback = '') {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return fallback
  throw new Error(`${field} 必须是字符串`)
}

function asNumber(value, field, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === undefined || value === null) return fallback
  throw new Error(`${field} 必须是数字`)
}

function asBoolean(value, field, fallback) {
  if (typeof value === 'boolean') return value
  if (value === undefined || value === null) return fallback
  throw new Error(`${field} 必须是布尔值`)
}

function mapIds(items, label) {
  const idMap = new Map()
  const seen = new Set()
  let remapped = 0
  for (const item of items) {
    const oldId = asString(item?.id, `${label}.id`)
    if (!oldId) throw new Error(`${label} 存在空 id`)
    if (idMap.has(oldId)) throw new Error(`${label} 存在重复 id：${oldId}`)
    let nextId = UUID_RE.test(oldId) ? oldId.toLowerCase() : randomUUID()
    while (seen.has(nextId)) nextId = randomUUID()
    if (nextId !== oldId) remapped += 1
    seen.add(nextId)
    idMap.set(oldId, nextId)
  }
  return { idMap, remapped }
}

async function writeJson(outDir, name, value) {
  await writeFile(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.owner || !UUID_RE.test(options.owner)) throw new Error('--owner 必须是 Supabase Auth 用户 UUID')
  if (!options.input) throw new Error('--input 必填')
  if (!options.out) throw new Error('--out 必填，且应位于 scratch/（不进入 Git）')

  const raw = await readFile(options.input, 'utf8')
  const store = JSON.parse(raw)
  if (!store || typeof store !== 'object' || Array.isArray(store)) throw new Error('根对象不合法')
  const cards = assertArray(store.cards, 'cards')
  const tags = assertArray(store.tags, 'tags')
  const promptTags = assertArray(store.promptTags, 'promptTags')
  const owner = options.owner.toLowerCase()

  const { idMap: cardIds, remapped: remappedCards } = mapIds(cards, 'cards')
  const versions = cards.flatMap((card) => assertArray(card?.versions ?? [], `cards(${card?.id ?? 'unknown'}).versions`))
  const { idMap: versionIds, remapped: remappedVersions } = mapIds(versions, 'versions')
  const { idMap: tagIds, remapped: remappedTags } = mapIds(tags, 'tags')

  const outCards = cards.map((rawCard) => {
    const card = rawCard ?? {}
    const id = cardIds.get(asString(card.id, 'cards.id'))
    const code = card.code === null || card.code === undefined ? null : asString(card.code, 'cards.code').trim().toLowerCase()
    if (code && !/^[a-z0-9-]{1,64}$/.test(code)) throw new Error(`卡片 ${id} 的调取码不符合规范：${code}`)
    const rating = asNumber(card.rating, 'cards.rating')
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) throw new Error(`卡片 ${id} 的 rating 必须是 0–5 整数`)
    const copyCount = asNumber(card.copyCount, 'cards.copyCount')
    if (!Number.isInteger(copyCount) || copyCount < 0) throw new Error(`卡片 ${id} 的 copyCount 必须为非负整数`)
    return {
      id,
      owner_user_id: owner,
      title: asString(card.title, 'cards.title').trim() || '未命名提示词',
      body: asString(card.body, 'cards.body'),
      code,
      rating,
      copy_count: copyCount,
      thinking_summary: card.thinkingSummary === null || card.thinkingSummary === undefined ? null : asString(card.thinkingSummary, 'cards.thinkingSummary'),
      notes: asString(card.notes, 'cards.notes'),
      source_url: asString(card.sourceUrl, 'cards.sourceUrl'),
      revision: 1,
      created_at: asString(card.createdAt, 'cards.createdAt'),
      updated_at: asString(card.updatedAt, 'cards.updatedAt'),
      last_modified_by: owner,
    }
  })

  const codeSet = new Set()
  for (const card of outCards) {
    if (!card.code) continue
    if (codeSet.has(card.code)) throw new Error(`调取码重复：${card.code}`)
    codeSet.add(card.code)
  }

  const outVersions = []
  for (const rawCard of cards) {
    const oldCardId = asString(rawCard.id, 'cards.id')
    const cardId = cardIds.get(oldCardId)
    for (const rawVersion of assertArray(rawCard.versions ?? [], `cards(${oldCardId}).versions`)) {
      const version = rawVersion ?? {}
      const oldVersionId = asString(version.id, 'versions.id')
      outVersions.push({
        id: versionIds.get(oldVersionId),
        card_id: cardId,
        owner_user_id: owner,
        body: asString(version.body, 'versions.body'),
        created_at: asString(version.createdAt, 'versions.createdAt'),
      })
    }
  }

  const outTags = tags.map((rawTag) => {
    const tag = rawTag ?? {}
    const oldTagId = asString(tag.id, 'tags.id')
    const oldParentId = tag.parent_id === null || tag.parent_id === undefined ? null : asString(tag.parent_id, 'tags.parent_id')
    if (oldParentId && !tagIds.has(oldParentId)) throw new Error(`标签 ${oldTagId} 的父标签不存在：${oldParentId}`)
    return {
      id: tagIds.get(oldTagId),
      owner_user_id: owner,
      name: asString(tag.name, 'tags.name').trim(),
      parent_id: oldParentId ? tagIds.get(oldParentId) : null,
      icon: tag.icon === null || tag.icon === undefined ? null : asString(tag.icon, 'tags.icon'),
      is_pinned: asBoolean(tag.is_pinned, 'tags.is_pinned', false),
      sort_order: asNumber(tag.sort_order, 'tags.sort_order', 0),
      created_at: asString(tag.created_at, 'tags.created_at'),
      updated_at: asString(tag.updated_at, 'tags.updated_at'),
      last_modified_by: owner,
    }
  })

  const tagNameKeys = new Set()
  for (const tag of outTags) {
    if (!tag.name || tag.name.length > 50) throw new Error(`标签名称不合法：${tag.name || '(空)'}`)
    const key = `${tag.parent_id ?? 'root'}\u0000${tag.name.toLocaleLowerCase('zh-CN')}`
    if (tagNameKeys.has(key)) throw new Error(`同级标签重名：${tag.name}`)
    tagNameKeys.add(key)
  }

  const relationKeys = new Set()
  const outPromptTags = promptTags.map((rawRelation) => {
    const relation = rawRelation ?? {}
    const oldPromptId = asString(relation.prompt_id, 'promptTags.prompt_id')
    const oldTagId = asString(relation.tag_id, 'promptTags.tag_id')
    const promptId = cardIds.get(oldPromptId)
    const tagId = tagIds.get(oldTagId)
    if (!promptId || !tagId) throw new Error(`发现悬空关联：${oldPromptId} → ${oldTagId}`)
    const key = `${promptId}\u0000${tagId}`
    if (relationKeys.has(key)) throw new Error(`发现重复关联：${oldPromptId} → ${oldTagId}`)
    relationKeys.add(key)
    return { prompt_id: promptId, tag_id: tagId, owner_user_id: owner }
  })

  const sourceSettings = store.settings && typeof store.settings === 'object' && !Array.isArray(store.settings) ? store.settings : {}
  const outSettings = {
    owner_user_id: owner,
    thinking_summary_prompt: asString(sourceSettings.thinkingSummaryPrompt, 'settings.thinkingSummaryPrompt'),
    confirm_delete: asBoolean(sourceSettings.confirmDelete, 'settings.confirmDelete', true),
    theme: ['dark', 'light', 'system'].includes(sourceSettings.theme) ? sourceSettings.theme : 'system',
    auto_format_body: asBoolean(sourceSettings.autoFormatBody, 'settings.autoFormatBody', false),
    body_alignment: ['left', 'center', 'right'].includes(sourceSettings.bodyAlignment) ? sourceSettings.bodyAlignment : 'left',
    composer_add_mode: sourceSettings.composerAddMode === 'manual' ? 'manual' : 'auto',
    hover_preview: asBoolean(sourceSettings.hoverPreview, 'settings.hoverPreview', false),
    ai_provider: asString(sourceSettings.aiProvider, 'settings.aiProvider', 'deepseek'),
    ai_model: asString(sourceSettings.aiModel, 'settings.aiModel', 'deepseek-v4-flash'),
    ai_base_url: asString(sourceSettings.aiBaseUrl, 'settings.aiBaseUrl'),
    revision: 1,
    last_modified_by: owner,
  }

  const outDir = path.resolve(options.out)
  await mkdir(outDir, { recursive: true })
  await Promise.all([
    writeJson(outDir, 'cards.json', outCards),
    writeJson(outDir, 'card_versions.json', outVersions),
    writeJson(outDir, 'tags.json', outTags),
    writeJson(outDir, 'prompt_tags.json', outPromptTags),
    writeJson(outDir, 'settings.json', outSettings),
    writeJson(outDir, 'manifest.json', {
      source_file: path.resolve(options.input),
      source_version: typeof store.version === 'number' ? store.version : null,
      owner_user_id: owner,
      generated_at: new Date().toISOString(),
      counts: {
        cards: outCards.length,
        card_versions: outVersions.length,
        tags: outTags.length,
        prompt_tags: outPromptTags.length,
      },
      remapped_legacy_ids: {
        cards: remappedCards,
        card_versions: remappedVersions,
        tags: remappedTags,
      },
      excluded_fields: ['cards.tags (derived from prompt_tags)', 'settings.aiApiKey'],
    }),
  ])

  console.log(`已生成审查用导入包：${outDir}`)
  console.log(`cards=${outCards.length} versions=${outVersions.length} tags=${outTags.length} promptTags=${outPromptTags.length}`)
  console.log(`重映射旧 ID：cards=${remappedCards} versions=${remappedVersions} tags=${remappedTags}`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
