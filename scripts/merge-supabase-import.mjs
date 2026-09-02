#!/usr/bin/env node

/**
 * 将多台设备的 Markdown 备份与当前 Mac 的 store.json 合并成一个审查用导入包。
 * 它只写入指定的 scratch/ 目录；不会连接 Supabase，也不会读取 .env 或上传数据。
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseArgs(argv) {
  const options = { backups: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i]
    if (name === '--help' || name === '-h') {
      console.log('用法：node scripts/merge-supabase-import.mjs --owner <uuid> --store <store.json> --backup <backup.md> [--backup <backup.md>] --out <scratch/目录>')
      process.exit(0)
    }
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`${name} 缺少值`)
    if (name === '--backup') options.backups.push(value)
    else if (['--owner', '--store', '--out'].includes(name)) options[name.slice(2)] = value
    else throw new Error(`未知参数：${name}`)
    i += 1
  }
  if (!options.owner || !UUID_RE.test(options.owner)) throw new Error('--owner 必须是 Supabase Auth 用户 UUID')
  if (!options.store || !options.out || options.backups.length === 0) throw new Error('--store、至少一个 --backup 与 --out 均为必填')
  return options
}

function stableUuid(seed) {
  const hex = createHash('sha256').update(seed).digest('hex')
  const chars = hex.slice(0, 32).split('')
  chars[12] = '4'
  chars[16] = '89ab'[Number.parseInt(chars[16], 16) % 4]
  return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12, 16).join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20).join('')}`
}

function normalize(value) {
  return String(value ?? '').replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim()
}

function comparisonBody(value) {
  return normalize(value).replace(/\s+/g, '')
}

function timestamp(value) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseMarkdownBackup(text, source) {
  const headings = /^##\s+(\d+)\.\s+(.+)$/gm
  const markers = []
  let first = true
  for (let match; (match = headings.exec(text));) {
    const before = text.slice(0, match.index)
    // 正文也可能有 ## 1. 或 ---；只有导出器的「分隔线 + 编号标题」才是新卡片。
    if (first || before.endsWith('\n---\n\n')) {
      markers.push({ index: match.index, heading: match[0], title: match[2].trim() })
      first = false
    }
  }
  return markers.map((marker, index) => {
    const end = index + 1 < markers.length ? markers[index + 1].index : text.length
    const section = text.slice(marker.index + marker.heading.length, end)
    const bodyMarker = /^###\s+正文\s*$/m.exec(section)
    if (!bodyMarker) throw new Error(`${source} 中的「${marker.title}」缺少“正文”段落`)
    const metadata = section.slice(0, bodyMarker.index)
    const get = (name) => (new RegExp(`^- ${name}：(.*)$`, 'm').exec(metadata)?.[1] ?? '').trim().replace('（未设置）', '')
    return {
      source,
      title: marker.title,
      body: section.slice(bodyMarker.index + bodyMarker[0].length).replace(/\n---\s*$/, '').trim(),
      tags: get('标签').split('、').map((tag) => tag.trim()).filter(Boolean),
      code: get('调取码') || null,
      rating: Number(get('评分')) || 0,
      copyCount: Number(get('复制次数')) || 0,
      createdAt: get('创建时间'),
      updatedAt: get('更新时间'),
      notes: '',
      sourceUrl: get('来源链接'),
      thinkingSummary: null,
      versions: [],
    }
  })
}

function sourcePriority(card) {
  return card.source === '当前 Mac 本地库' ? 1 : 0
}

function selectMostComplete(cards) {
  return [...cards].sort((a, b) =>
    comparisonBody(b.body).length - comparisonBody(a.body).length ||
    timestamp(b.updatedAt) - timestamp(a.updatedAt) ||
    sourcePriority(b) - sourcePriority(a),
  )[0]
}

function pickEarliest(values) {
  return values.filter((value) => timestamp(value) > 0).sort((a, b) => timestamp(a) - timestamp(b))[0] ?? new Date().toISOString()
}

function pickLatest(values) {
  return values.filter((value) => timestamp(value) > 0).sort((a, b) => timestamp(b) - timestamp(a))[0] ?? new Date().toISOString()
}

function canonicalTagKey(name) {
  return normalize(name).toLocaleLowerCase('zh-CN')
}

async function writeJson(outDir, name, value) {
  await writeFile(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const owner = options.owner.toLowerCase()
  const store = JSON.parse(await readFile(options.store, 'utf8'))
  const backupCards = []
  for (const backup of options.backups) {
    backupCards.push(...parseMarkdownBackup(await readFile(backup, 'utf8'), path.basename(backup)))
  }
  const currentCards = (store.cards ?? []).map((card) => ({
    source: '当前 Mac 本地库',
    title: normalize(card.title),
    body: normalize(card.body),
    tags: Array.isArray(card.tags) ? card.tags.map(normalize).filter(Boolean) : [],
    code: typeof card.code === 'string' && card.code.trim() ? card.code.trim().toLowerCase() : null,
    rating: Number.isInteger(card.rating) ? card.rating : 0,
    copyCount: Number.isInteger(card.copyCount) ? card.copyCount : 0,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    notes: normalize(card.notes),
    sourceUrl: normalize(card.sourceUrl),
    thinkingSummary: typeof card.thinkingSummary === 'string' ? card.thinkingSummary : null,
    versions: Array.isArray(card.versions) ? card.versions : [],
  }))
  const allCards = [...backupCards, ...currentCards]

  // 先按标题合并；主体选择最完整正文，任何不同正文都转入 card_versions，绝不静默丢弃。
  const byTitle = new Map()
  for (const card of allCards) {
    if (!card.title || !card.body) throw new Error(`发现空标题或空正文：${card.title || '(无标题)'}`)
    const key = normalize(card.title)
    byTitle.set(key, [...(byTitle.get(key) ?? []), card])
  }
  const candidates = [...byTitle.entries()].map(([title, rows]) => {
    const uniqueBodies = new Map()
    for (const row of rows) uniqueBodies.set(comparisonBody(row.body), [...(uniqueBodies.get(comparisonBody(row.body)) ?? []), row])
    const bodyCandidates = [...uniqueBodies.values()].map(selectMostComplete)
    return { title, rows, bodyCandidates, primary: selectMostComplete(bodyCandidates) }
  })

  // 同正文、不同标题也只保留一张卡，用 notes 保存别名，避免重复但不遗失检索线索。
  const byPrimaryBody = new Map()
  for (const candidate of candidates) {
    const key = comparisonBody(candidate.primary.body)
    byPrimaryBody.set(key, [...(byPrimaryBody.get(key) ?? []), candidate])
  }
  const mergedGroups = [...byPrimaryBody.values()].map((sameBodyTitles) => {
    const primaryCandidate = [...sameBodyTitles].sort((a, b) =>
      timestamp(b.primary.updatedAt) - timestamp(a.primary.updatedAt) || sourcePriority(b.primary) - sourcePriority(a.primary),
    )[0]
    const rows = sameBodyTitles.flatMap((candidate) => candidate.rows)
    const bodyCandidates = sameBodyTitles.flatMap((candidate) => candidate.bodyCandidates)
    return {
      title: primaryCandidate.title,
      aliases: sameBodyTitles.map((candidate) => candidate.title).filter((title) => title !== primaryCandidate.title),
      rows,
      primary: primaryCandidate.primary,
      bodyCandidates,
    }
  })

  const currentTags = Array.isArray(store.tags) ? store.tags : []
  const currentTagByOldId = new Map(currentTags.map((tag) => [tag.id, tag]))
  const tagNames = new Map()
  for (const tag of currentTags) tagNames.set(canonicalTagKey(tag.name), normalize(tag.name))
  for (const group of mergedGroups) for (const row of group.rows) for (const name of row.tags) {
    if (!tagNames.has(canonicalTagKey(name))) tagNames.set(canonicalTagKey(name), normalize(name))
  }
  const tagIds = new Map([...tagNames.entries()].map(([key]) => [key, stableUuid(`prompt-manager-import:tag:${key}`)]))
  const tags = [...tagNames.entries()].map(([key, name], index) => {
    const current = currentTags.find((tag) => canonicalTagKey(tag.name) === key)
    const parent = current?.parent_id ? currentTagByOldId.get(current.parent_id) : null
    const parentKey = parent ? canonicalTagKey(parent.name) : null
    return {
      id: tagIds.get(key), owner_user_id: owner, name,
      parent_id: parentKey ? tagIds.get(parentKey) : null,
      icon: typeof current?.icon === 'string' ? current.icon : null,
      is_pinned: current?.is_pinned === true,
      sort_order: Number.isInteger(current?.sort_order) ? current.sort_order : index,
      created_at: typeof current?.created_at === 'string' ? current.created_at : new Date().toISOString(),
      updated_at: typeof current?.updated_at === 'string' ? current.updated_at : new Date().toISOString(),
      last_modified_by: owner,
    }
  })

  const cards = []
  const cardVersions = []
  const promptTags = []
  // 同一调取码必须唯一。冲突时由正文更完整、再由更新时间更晚的卡片保留；
  // 另一张卡完整保留，只清空调取码，避免 MCP 调用落到不确定的内容上。
  const codeWinner = new Map()
  for (const group of mergedGroups) {
    const codes = [...new Set(group.rows.map((row) => row.code).filter(Boolean))]
    if (codes.length > 1) throw new Error(`同名提示词存在不同调取码：${group.title}`)
    const code = codes[0]
    if (!code) continue
    const currentWinner = codeWinner.get(code)
    if (!currentWinner || selectMostComplete([currentWinner.primary, group.primary]) === group.primary) {
      codeWinner.set(code, group)
    }
  }
  for (const group of mergedGroups) {
    const cardId = stableUuid(`prompt-manager-import:card:${group.title}`)
    const primary = group.primary
    const codes = [...new Set(group.rows.map((row) => row.code).filter(Boolean))]
    if (codes.length > 1) throw new Error(`同名提示词存在不同调取码：${group.title}`)
    const code = codes[0] ?? null
    const retainedCode = codeWinner.get(code) === group ? code : null
    const allTags = [...new Set(group.rows.flatMap((row) => row.tags).map(canonicalTagKey))]
    const aliasesNote = group.aliases.length ? `别名：${group.aliases.join('、')}` : ''
    const existingNotes = group.rows.map((row) => row.notes).filter(Boolean)
    cards.push({
      id: cardId, owner_user_id: owner, title: group.title, body: primary.body, code: retainedCode,
      rating: Math.max(...group.rows.map((row) => row.rating)),
      copy_count: Math.max(...group.rows.map((row) => row.copyCount)),
      thinking_summary: group.rows.map((row) => row.thinkingSummary).find(Boolean) ?? null,
      notes: [...existingNotes, aliasesNote].filter(Boolean).join('\n\n'),
      source_url: group.rows.map((row) => row.sourceUrl).find(Boolean) ?? '',
      revision: 1,
      created_at: pickEarliest(group.rows.map((row) => row.createdAt)),
      updated_at: pickLatest(group.rows.map((row) => row.updatedAt)),
      last_modified_by: owner,
    })
    for (const tagKey of allTags) promptTags.push({ prompt_id: cardId, tag_id: tagIds.get(tagKey), owner_user_id: owner })

    const versionBodies = new Map()
    for (const candidate of group.bodyCandidates) versionBodies.set(comparisonBody(candidate.body), { body: candidate.body, createdAt: candidate.updatedAt })
    for (const row of group.rows) for (const version of row.versions ?? []) {
      if (typeof version?.body === 'string' && version.body.trim()) versionBodies.set(comparisonBody(version.body), { body: version.body, createdAt: version.createdAt })
    }
    versionBodies.delete(comparisonBody(primary.body))
    for (const [bodyKey, version] of versionBodies) cardVersions.push({
      id: stableUuid(`prompt-manager-import:version:${group.title}:${bodyKey}`),
      card_id: cardId, owner_user_id: owner, body: version.body,
      created_at: typeof version.createdAt === 'string' && timestamp(version.createdAt) ? version.createdAt : primary.updatedAt,
    })
  }

  const settings = store.settings && typeof store.settings === 'object' ? store.settings : {}
  const output = {
    cards,
    card_versions: cardVersions,
    tags,
    prompt_tags: promptTags,
    settings: {
      owner_user_id: owner,
      thinking_summary_prompt: typeof settings.thinkingSummaryPrompt === 'string' ? settings.thinkingSummaryPrompt : '',
      confirm_delete: typeof settings.confirmDelete === 'boolean' ? settings.confirmDelete : true,
      theme: ['dark', 'light', 'system'].includes(settings.theme) ? settings.theme : 'system',
      auto_format_body: settings.autoFormatBody === true,
      body_alignment: ['left', 'center', 'right'].includes(settings.bodyAlignment) ? settings.bodyAlignment : 'left',
      composer_add_mode: settings.composerAddMode === 'manual' ? 'manual' : 'auto',
      hover_preview: settings.hoverPreview === true,
      ai_provider: typeof settings.aiProvider === 'string' ? settings.aiProvider : 'deepseek',
      ai_model: typeof settings.aiModel === 'string' ? settings.aiModel : 'deepseek-v4-flash',
      ai_base_url: typeof settings.aiBaseUrl === 'string' ? settings.aiBaseUrl : '',
      revision: 1, last_modified_by: owner,
    },
  }
  const outDir = path.resolve(options.out)
  await mkdir(outDir, { recursive: true })
  await Promise.all([
    writeJson(outDir, 'merged-import.json', output),
    writeJson(outDir, 'manifest.json', {
      generated_at: new Date().toISOString(), owner_user_id: owner,
      source_files: [path.resolve(options.store), ...options.backups.map((file) => path.resolve(file))],
      source_rows: allCards.length,
      exact_unique_title_and_body: new Set(allCards.map((row) => `${normalize(row.title)}\u0000${comparisonBody(row.body)}`)).size,
      same_title_groups: candidates.length,
      merged_same_body_title_aliases: mergedGroups.filter((group) => group.aliases.length > 0).map((group) => ({ title: group.title, aliases: group.aliases })),
      counts: { cards: cards.length, card_versions: cardVersions.length, tags: tags.length, prompt_tags: promptTags.length },
      excluded_fields: ['settings.aiApiKey'],
    }),
  ])
  console.log(`合并导入包已生成：${outDir}`)
  console.log(`cards=${cards.length} versions=${cardVersions.length} tags=${tags.length} promptTags=${promptTags.length}`)
}

main().catch((error) => {
  console.error(`合并导入包生成失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
