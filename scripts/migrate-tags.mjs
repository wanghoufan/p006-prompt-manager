#!/usr/bin/env node
// 标签系统一次性迁移：32 卡字符串标签 → tags 实体 + prompt_tags 关联（11 实体 / 55 关联）。
// 用法：
//   node scripts/migrate-tags.mjs            # dry-run（只报告，不写盘）
//   node scripts/migrate-tags.mjs --apply    # 备份 + 落盘 + 校验
// 设计对齐 docs/review/标签系统-迁移方案.md §二-§八。

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_FILE = path.join(ROOT, 'data', 'store.json')

// 脏数据合并规则：键为存量标签，值为合并目标；null 表示删除（不建实体、不建关系）
const MERGE = {
  多age: '多agent编程', // 截断碎片 → 完整名
  多aengt编程: '多agent编程', // 错别字 → 正确名
  无法分类: null, // DISCARD 占位 → 删除
}

function nowIso() {
  return new Date().toISOString()
}

function timestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function isString(v) {
  return typeof v === 'string'
}

function isCard(v) {
  if (!v || typeof v !== 'object') return false
  const x = v
  return (
    isString(x.id) &&
    isString(x.title) &&
    isString(x.body) &&
    Array.isArray(x.tags) &&
    x.tags.every(isString) &&
    typeof x.rating === 'number' &&
    typeof x.copyCount === 'number' &&
    Array.isArray(x.versions) &&
    isString(x.createdAt) &&
    isString(x.updatedAt)
  )
}

async function readStore() {
  const raw = await fs.readFile(DATA_FILE, 'utf8')
  return JSON.parse(raw)
}

/** 计算合并后的标签名（单个）；返回 null 表示删除 */
function mergeName(t) {
  return Object.prototype.hasOwnProperty.call(MERGE, t) ? MERGE[t] : t
}

/** dry-run：产出 tags / promptTags / 合并后卡 tags / 报告 */
function dryRun(raw) {
  const cards = (raw.cards || []).filter(isCard)
  const freq = new Map() // 合并后 标签名 -> 频次
  const cardTagCount = new Map() // 卡片 id -> 关系数（去重后）
  const report = { merges: [], deletes: [], dedupes: [], cardCount: cards.length, beforeEntries: 0 }

  // 第一遍：统计频次 + 校验去重 + 记录原始条目数
  for (const c of cards) {
    const seen = new Set()
    for (const t of c.tags || []) {
      report.beforeEntries++
      const target = mergeName(t)
      if (target === null) {
        report.deletes.push(t)
        continue
      }
      if (target !== t) report.merges.push(`${t} → ${target}`)
      freq.set(target, (freq.get(target) ?? 0) + 1)
      if (seen.has(target)) report.dedupes.push(`卡 ${c.id} 合并后重复: ${target} → 已去重`)
      seen.add(target)
    }
    cardTagCount.set(c.id, seen.size)
  }

  // 按频次降序 + 名称 locale 排序 → 分配 tag_001…
  const ordered = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
  const nameToId = new Map()
  const tags = ordered.map(([name], i) => {
    const id = `tag_${String(i + 1).padStart(3, '0')}`
    nameToId.set(name, id)
    return {
      id,
      name,
      parent_id: null,
      icon: null,
      is_pinned: false,
      sort_order: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
  })

  // 第二遍：生成 promptTags + 合并后卡 tags（方案 A 保留 Card.tags 冗余）
  const promptTags = []
  const cardsOut = cards.map((c) => {
    const seen = new Set()
    const names = []
    for (const t of c.tags || []) {
      const target = mergeName(t)
      if (target === null || seen.has(target)) continue
      seen.add(target)
      const id = nameToId.get(target)
      if (id) {
        names.push(target)
        promptTags.push({ prompt_id: c.id, tag_id: id })
      }
    }
    return { ...c, tags: names }
  })

  return { tags, promptTags, cards: cardsOut, report, freq, nameToId, ordered }
}

/** 一致性校验（迁移方案 §7.2），返回错误数组（空 = 通过） */
function validate(state) {
  const errors = []
  const tagIds = new Set(state.tags.map((t) => t.id))
  const promptIds = new Set(state.cards.map((c) => c.id))
  const cardSum = state.cards.reduce((s, c) => s + new Set(c.tags).size, 0)

  if (state.promptTags.length !== cardSum) {
    errors.push(`关联数不一致: promptTags=${state.promptTags.length} vs cards.tags=${cardSum}`)
  }
  for (const rt of state.promptTags) {
    if (!tagIds.has(rt.tag_id)) errors.push(`孤儿关系: ${rt.prompt_id} → ${rt.tag_id}`)
    if (!promptIds.has(rt.prompt_id)) errors.push(`关系引用缺失卡片: ${rt.prompt_id}`)
  }
  const keySet = new Set(state.promptTags.map((rt) => `${rt.prompt_id}|${rt.tag_id}`))
  if (keySet.size !== state.promptTags.length) errors.push('存在重复 (prompt_id, tag_id) 关系')
  for (const c of state.cards) {
    if (!isCard(c)) errors.push(`卡片非法: ${c.id ?? '(无id)'}`)
  }
  const unused = state.tags.filter((t) => !state.promptTags.some((rt) => rt.tag_id === t.id))
  return { errors, unused }
}

function printReport(res, applied) {
  const { tags, promptTags, cards, report } = res
  const line = '═'.repeat(46)
  console.log(line)
  console.log('标签迁移', applied ? '报告（已落盘）' : 'dry-run 报告')
  console.log(line)
  console.log(`卡片总数: ${cards.length} | 迁移前 tag 条目: ${report.beforeEntries} | 迁移后 promptTags: ${promptTags.length}`)
  console.log('')
  if (report.merges.length) {
    console.log('[合并]')
    report.merges.forEach((m) => console.log('  ' + m))
  }
  if (report.deletes.length) {
    console.log('[删除]')
    report.deletes.forEach((d) => console.log('  ' + d + '（不建实体）'))
  }
  if (report.dedupes.length) {
    console.log('[去重]')
    report.dedupes.forEach((d) => console.log('  ' + d))
  }
  console.log('')
  console.log(`[实体清单] 共 ${tags.length} 个`)
  for (const t of tags) {
    const src = report.merges.filter((m) => m.includes(t.name)).length ? '  ← 有合并来源' : ''
    console.log(`${t.id}  ${t.name.padEnd(12)} ${String(directOf(res, t.id)).padStart(3)}${src}`)
  }
  console.log('')
  const { errors, unused } = validate({ tags, promptTags, cards })
  console.log('[一致性校验]')
  console.log(`  tags: ${tags.length} | promptTags: ${promptTags.length} | 无孤儿: ${errors.every((e) => !e.includes('孤儿')) ? '✓' : '✗'}`)
  if (unused.length) {
    console.log(`  ⚠ ${unused.length} 个未使用标签: ${unused.map((u) => u.name).join(', ')}`)
  } else {
    console.log('  ✓ 0 个未使用标签')
  }
  if (errors.length) {
    console.log('  ✗ 校验失败:')
    errors.forEach((e) => console.log('    - ' + e))
  } else {
    console.log('  ✓ 全部通过（55 关联 / 0 孤儿 / 0 重复 / 卡片完整）')
  }
  console.log(line)
  console.log(applied ? '迁移完成，已写盘。' : 'dry-run 完成，未写盘（加 --apply 生效）。')
  return errors.length
}

function directOf(res, tagId) {
  return res.promptTags.filter((rt) => rt.tag_id === tagId).length
}

async function main() {
  const apply = process.argv.includes('--apply')
  const raw = await readStore()
  const res = dryRun(raw)

  if (!apply) {
    printReport(res, false)
    return
  }

  // 备份
  const bak = `${DATA_FILE}.bak-${timestamp()}`
  await fs.copyFile(DATA_FILE, bak)
  console.log(`已备份: ${path.basename(bak)}`)

  const next = {
    ...raw,
    version: (typeof raw.version === 'number' ? raw.version : 1) + 1,
    cards: res.cards,
    tags: res.tags,
    promptTags: res.promptTags,
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8')

  const errCount = printReport(res, true)
  if (errCount > 0) {
    console.log(`\n⚠ 校验未通过（${errCount} 项错误）。回滚请执行: cp "${bak}" "${DATA_FILE}"`)
    process.exitCode = 1
  } else {
    console.log('\n✓ 迁移成功。tags=11 / promptTags=55 / 0 孤儿。')
  }
}

main().catch((err) => {
  console.error('迁移脚本执行失败:', err)
  process.exitCode = 1
})
