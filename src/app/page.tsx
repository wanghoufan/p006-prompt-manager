'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Settings, SortMode, Tag, PromptTag, TagFilterMode, TagFilters } from '@/lib/types'
import { loadCards, loadSettings, loadTags, loadPromptTags, parseImport, saveCards, saveSettings, saveTags, savePromptTags, buildMarkdownExport, isServerAvailable, loadFromServer, pushToServer, subscribeSync, sanitizePromptTags, setConflictRefreshHandler } from '@/lib/storage'
import { createCard, normalizeBody, parseTags, rollbackToVersion, saveBodyOnly, saveBodyWithVersion } from '@/lib/cards'
import { DEMO_CARDS } from '@/lib/demo'
import { nowIso } from '@/lib/util'
import { TopBar } from '@/components/TopBar'
import type { ViewMode } from '@/components/DemoMenu'
import { TagPanel } from '@/components/TagPanel'
import { Composer } from '@/components/Composer'
import { SortBar } from '@/components/SortBar'
import { CardItem } from '@/components/CardItem'
import { PreviewPanel } from '@/components/PreviewPanel'
import { CardDetail } from '@/components/CardDetail'
import { SettingsModal } from '@/components/SettingsModal'
import { Toast } from '@/components/Toast'
import {
  createTag,
  renameTag,
  moveTag,
  reorderTag,
  deleteTag,
  mergeTags,
  setCardTags,
  addCardTag,
  removeCardTag,
  collectDescendantIds,
  isNameUnique,
  assertNoCycle,
  tagPath,
  deriveTagsFromCards,
  syncCardsToPromptTags,
} from '@/lib/tags'

// P2-8 搜索相关度打分：命中字段优先级 title=4 / code=3 / tag=3 / notes=2 / body=1，取最高分
function relevanceScore(c: Card, term: string): number {
  const t = term.toLowerCase()
  if (c.title.toLowerCase().includes(t)) return 4
  if ((c.code ?? '').toLowerCase().includes(t)) return 3
  if (c.tags.some((tag) => tag.toLowerCase().includes(t))) return 3
  if ((c.notes ?? '').toLowerCase().includes(t)) return 2
  if (c.body.toLowerCase().includes(t)) return 1
  return 0
}

// 现有 sortMode 三分支排序逻辑（updated / copies / rating）
function compareBySortMode(a: Card, b: Card, mode: SortMode): number {
  if (mode === 'copies') return b.copyCount - a.copyCount || b.updatedAt.localeCompare(a.updatedAt)
  if (mode === 'rating') return b.rating - a.rating || b.updatedAt.localeCompare(a.updatedAt)
  return b.updatedAt.localeCompare(a.updatedAt)
}

export default function Home() {
  const [cards, setCards] = useState<Card[]>([])
  const [settings, setSettings] = useState<Settings>(() => ({
    thinkingSummaryPrompt: '',
    confirmDelete: true,
    theme: 'system',
    autoFormatBody: false,
    bodyAlignment: 'left',
  }))
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<ViewMode>('mine')
  const [tagFilters, setTagFilters] = useState<TagFilters>({
    any: [],
    all: [],
    none: [],
    untaggedOnly: false,
    includeDescendants: true,
  })
  const [tags, setTags] = useState<Tag[]>([])
  const [promptTags, setPromptTags] = useState<PromptTag[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  // 全局搜索（范围 A）：searchQuery 为受控输入即时值，debouncedQuery 为 300ms 防抖后的过滤依据；
  // 搜索词不持久化（刷新即清，仅 useState）
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<{ msg: string; detail?: string[] | null; withUndo?: boolean } | null>(null)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  // P2-7：实时同步订阅句柄，重连前先关闭旧订阅，避免 EventSource 叠加
  const syncUnsubRef = useRef<(() => void) | null>(null)
  // P2-11 批量多选：选中卡片 id 集合（demo 视图不启用）
  const [bulkIds, setBulkIds] = useState<ReadonlySet<string>>(new Set())
  const undoRef = useRef<(() => void) | null>(null)

  const notify = useCallback((msg: string, detail?: string[]) => {
    undoRef.current = null
    setToast({ msg, detail: detail && detail.length > 0 ? detail : null })
  }, [])

  // P2-5 撤销栈：缓存操作前快照，Toast 内 10s「撤销」可回退
  const notifyWithUndo = useCallback((msg: string, undo: () => void) => {
    undoRef.current = undo
    setToast({ msg, withUndo: true })
  }, [])

  function handleUndo() {
    const undo = undoRef.current
    undoRef.current = null
    setToast(null)
    undo?.()
  }

  useEffect(() => {
    if (!toast) return
    // 详情列表延长至 6s，撤销 Toast 给 10s，普通 2.2s
    const duration = toast.withUndo ? 10000 : toast.detail && toast.detail.length > 0 ? 6000 : 2200
    const timer = window.setTimeout(() => {
      setToast(null)
      undoRef.current = null
    }, duration)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 全局搜索 300ms 防抖（纯前端过滤，无依赖）
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  // P0-5 主题应用：light class 由 settings.theme 驱动；
  // system 模式监听系统偏好实时跟随（layout 内联脚本已做首屏预置，此处幂等接管）
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const light = settings.theme === 'light' || (settings.theme === 'system' && mq.matches)
      root.classList.toggle('light', light)
    }
    apply()
    if (settings.theme === 'system') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [settings.theme])

  const isDemoView = view === 'demo'
  const sourceCards = isDemoView ? DEMO_CARDS : cards

  // P2-7：统一的同步连接例程（首屏启动 + 「重试连接」复用）。
  // 先关闭旧订阅避免 EventSource 叠加；serverOnline=null 表示连接中/迁移中。
  const connect = useCallback(async () => {
    if (syncUnsubRef.current) {
      syncUnsubRef.current()
      syncUnsubRef.current = null
    }
    setServerOnline(null)
    const serverOk = await isServerAvailable()
    if (!serverOk) {
      // 离线兜底：使用本机 localStorage 数据
      setServerOnline(false)
      setCards(loadCards())
      setSettings(loadSettings())
      setTags(loadTags())
      setPromptTags(loadPromptTags())
      setHydrated(true)
      notify('未连接同步服务，已使用本机本地数据（不同步）')
      return
    }
    const remote = await loadFromServer()
    if (!remote) {
      setServerOnline(false)
      setHydrated(true)
      return
    }
    setServerOnline(true)
    // 服务端为空但本机有数据：首次迁移上传，避免两边永远为空
    if (remote.cards.length === 0) {
      const local = loadCards()
      if (local.length > 0) {
        const localTags = loadTags()
        const localPromptTags = loadPromptTags()
        await pushToServer(local, loadSettings(), localTags, localPromptTags)
        setCards(local)
        setSettings(loadSettings())
        setTags(localTags)
        setPromptTags(sanitizePromptTags(localPromptTags, local, localTags))
      }
    } else {
      setCards(remote.cards)
      setSettings(remote.settings)
      setTags(remote.tags)
      setPromptTags(remote.promptTags)
    }
    // 订阅实时同步：另一台电脑改动时自动拉取最新数据
    syncUnsubRef.current = subscribeSync((rc, rs, rt, rpt) => {
      setCards(rc)
      setSettings(rs)
      setTags(rt)
      setPromptTags(rpt)
    })
    setHydrated(true)
  }, [notify])

  useEffect(() => {
    // 延迟到计时器回调中执行，避免 effect 同步体内直接 setState（react-hooks/set-state-in-effect）
    const timer = window.setTimeout(() => {
      void connect()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      if (syncUnsubRef.current) {
        syncUnsubRef.current()
        syncUnsubRef.current = null
      }
    }
  }, [connect])

  useEffect(() => {
    if (!hydrated) return
    if (!saveCards(cards)) {
      const timer = window.setTimeout(
        () => notify('保存失败：localStorage 空间不足，可先导出备份'),
        0,
      )
      return () => window.clearTimeout(timer)
    }
  }, [cards, hydrated, notify])

  // P0-A 版本冲突回调：另一设备已更新且本次写入被拒绝 → 重载服务端权威视图并提示用户重试
  useEffect(() => {
    setConflictRefreshHandler((data) => {
      setCards(data.cards)
      setSettings(data.settings)
      setTags(data.tags)
      setPromptTags(data.promptTags)
      notify('检测到其他设备更新了数据，已刷新至最新版本，请重试刚才的操作')
    })
  }, [notify])

  useEffect(() => {
    if (hydrated) saveSettings(settings)
  }, [settings, hydrated])

  useEffect(() => {
    if (hydrated) saveTags(tags)
  }, [tags, hydrated])

  useEffect(() => {
    if (hydrated) savePromptTags(promptTags)
  }, [promptTags, hydrated])

  const updateCard = useCallback((id: string, patch: (c: Card) => Card) => {
    setCards((prev) => prev.map((c) => (c.id === id ? patch(c) : c)))
  }, [])

  const handleRate = useCallback((id: string, rating: number) => {
    updateCard(id, (c) => ({ ...c, rating }))
  }, [updateCard])

  // 活跃的 tags/promptTags 真源：demo 视图从 DEMO_CARDS 派生；mine 视图用服务端/本地 state；
  // 若 mine 视图 tags 为空但卡片仍有字符串标签（未迁移旧数据），兜底派生避免标签消失。
  const activeTagData = useMemo(() => {
    if (isDemoView) return deriveTagsFromCards(DEMO_CARDS)
    if (tags.length === 0 && cards.some((c) => c.tags.length > 0)) {
      return deriveTagsFromCards(cards)
    }
    return { tags, promptTags }
  }, [isDemoView, tags, promptTags, cards])
  const activeTags = activeTagData.tags
  const activePromptTags = activeTagData.promptTags
  const activeTagIds = useMemo(() => new Set(activeTags.map((tag) => tag.id)), [activeTags])
  const effectiveTagFilters = useMemo<TagFilters>(
    () => ({
      ...tagFilters,
      any: tagFilters.any.filter((id) => activeTagIds.has(id)),
      all: tagFilters.all.filter((id) => activeTagIds.has(id)),
      none: tagFilters.none.filter((id) => activeTagIds.has(id)),
    }),
    [tagFilters, activeTagIds],
  )

  // AI 生成接口用的标签名列表（供补全候选 / 避免生成重复标签）
  const existingTags = useMemo(() => activeTags.map((t) => t.name), [activeTags])

  // 无标签卡片数（未与任何标签建立关联的卡片）
  const untaggedCount = useMemo(() => {
    const linked = new Set(activePromptTags.map((rt) => rt.prompt_id))
    return sourceCards.filter((c) => !linked.has(c.id)).length
  }, [sourceCards, activePromptTags])

  const allCodes = useMemo(
    () => cards.map((c) => c.code).filter((c): c is string => Boolean(c)),
    [cards],
  )

  // 过滤链三段：baseCards（视图 + 组合标签）→ 搜索过滤（AND 叠加）→ 排序。
  // 三组条件之间也是 AND：(any 命中任一) AND (all 逐个命中) AND (none 全部不命中)。
  const baseCards = useMemo(() => {
    if (effectiveTagFilters.untaggedOnly) {
      const linked = new Set(activePromptTags.map((rt) => rt.prompt_id))
      return sourceCards.filter((c) => !linked.has(c.id))
    }
    const hasTagConditions =
      effectiveTagFilters.any.length + effectiveTagFilters.all.length + effectiveTagFilters.none.length > 0
    if (!hasTagConditions) return sourceCards

    const promptTagIds = new Map<string, Set<string>>()
    for (const relation of activePromptTags) {
      const ids = promptTagIds.get(relation.prompt_id) ?? new Set<string>()
      ids.add(relation.tag_id)
      promptTagIds.set(relation.prompt_id, ids)
    }
    const conditionIds = (tagId: string) =>
      effectiveTagFilters.includeDescendants
        ? new Set([tagId, ...collectDescendantIds(activeTags, tagId)])
        : new Set([tagId])
    const anyConditions = effectiveTagFilters.any.map(conditionIds)
    const allConditions = effectiveTagFilters.all.map(conditionIds)
    const noneConditions = effectiveTagFilters.none.map(conditionIds)
    const matches = (cardId: string, condition: Set<string>) => {
      const cardTagIds = promptTagIds.get(cardId)
      return cardTagIds ? [...condition].some((id) => cardTagIds.has(id)) : false
    }

    return sourceCards.filter((card) => {
      const passesAny = anyConditions.length === 0 || anyConditions.some((condition) => matches(card.id, condition))
      const passesAll = allConditions.every((condition) => matches(card.id, condition))
      const passesNone = noneConditions.every((condition) => !matches(card.id, condition))
      return passesAny && passesAll && passesNone
    })
  }, [sourceCards, effectiveTagFilters, activeTags, activePromptTags])

  const tagFilterSummary = useMemo(() => {
    if (effectiveTagFilters.untaggedOnly) return '无标签'
    const names = (ids: string[]) => ids.map((id) => tagPath(activeTags, id)).join('、')
    const parts: string[] = []
    if (effectiveTagFilters.any.length > 0) parts.push(`OR: ${names(effectiveTagFilters.any)}`)
    if (effectiveTagFilters.all.length > 0) parts.push(`AND: ${names(effectiveTagFilters.all)}`)
    if (effectiveTagFilters.none.length > 0) parts.push(`NOT: ${names(effectiveTagFilters.none)}`)
    return parts.join(' · ')
  }, [effectiveTagFilters, activeTags])

  const searchActive = debouncedQuery.trim().length > 0
  const searchTerm = debouncedQuery.trim()

  const visibleCards = useMemo(() => {
    let list = baseCards
    if (searchActive) {
      const term = searchTerm.toLowerCase()
      if (term.startsWith('@')) {
        // @code 直达：仅按调取码过滤（不区分大小写）
        const codeTerm = term.slice(1)
        list = list.filter((c) => (c.code ?? '').toLowerCase().includes(codeTerm))
      } else {
        // 多字段包含匹配：标题 / 正文 / 标签 / 调取码 / 备注
        list = list.filter((c) => {
          const code = (c.code ?? '').toLowerCase()
          return (
            c.title.toLowerCase().includes(term) ||
            c.body.toLowerCase().includes(term) ||
            c.tags.some((t) => t.toLowerCase().includes(term)) ||
            code.includes(term) ||
            (c.notes ?? '').toLowerCase().includes(term)
          )
        })
      }
    }
    const arr = [...list]
    // P2-8：搜索激活（非 @code 模式）时先按相关度排序（score desc），同分再按现有 sortMode 二级排序；
    // @code 直达仅按调取码匹配，保持原有 sortMode；无搜索时维持原 sortMode
    if (searchActive && !searchTerm.startsWith('@')) {
      arr.sort((a, b) => {
        const sa = relevanceScore(a, searchTerm)
        const sb = relevanceScore(b, searchTerm)
        if (sa !== sb) return sb - sa
        return compareBySortMode(a, b, sortMode)
      })
    } else {
      arr.sort((a, b) => compareBySortMode(a, b, sortMode))
    }
    return arr
  }, [baseCards, searchActive, searchTerm, sortMode])

  const detailCard = detailId ? sourceCards.find((c) => c.id === detailId) ?? null : null
  const previewCard = selectedId ? sourceCards.find((c) => c.id === selectedId) ?? null : null

  /** 把标签名列表解析为 tag id：同名（任意父级，优先顶级）复用，不存在则新建顶级标签实体。
   *  返回最终 tagIds（去重、保持顺序、trim）与可能扩展后的 tags。 */
  function resolveTagIds(names: string[]): { tagIds: string[]; nextTags: Tag[] } {
    let nextTags = tags
    const tagIds: string[] = []
    const seen = new Set<string>()
    for (const raw of names) {
      const name = raw.trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      // 优先匹配顶级同名标签，其次任意父级同名
      let found = nextTags.find((t) => t.parent_id === null && t.name === name) ?? nextTags.find((t) => t.name === name)
      if (!found) {
        const [updated, created] = createTag(nextTags, name, null)
        nextTags = updated
        found = created
      }
      tagIds.push(found.id)
    }
    return { tagIds, nextTags }
  }

  /** 标签集合原子落盘：更新 tags + promptTags 后，同步重建所有卡片的 Card.tags 冗余字段 */
  function applyTags(nextTags: Tag[], nextPromptTags: PromptTag[]) {
    setTags(nextTags)
    setPromptTags(nextPromptTags)
    setCards((prev) => syncCardsToPromptTags(prev, nextTags, nextPromptTags))
  }

  // P0-A 标签级操作撤销快照：缓存操作前 tags/promptTags/cards，10s 内整体回退
  function captureTagSnapshot() {
    return { cards, tags, promptTags, tagFilters }
  }
  function restoreTagSnapshot(snap: {
    cards: Card[]
    tags: Tag[]
    promptTags: PromptTag[]
    tagFilters: TagFilters
  }) {
    setCards(snap.cards)
    setTags(snap.tags)
    setPromptTags(snap.promptTags)
    setTagFilters(snap.tagFilters)
  }

  function handleCreate(body: string, title: string, aiTags: string[]) {
    // P0-3 重复内容去重：normalizeBody 全等比对（大小写敏感、空白归一后），命中首个提示二次确认；
    // 空内容（bodyNorm 为空）不触发
    const bodyNorm = normalizeBody(body.trim())
    if (bodyNorm) {
      const existing = cards.find((c) => normalizeBody(c.body.trim()) === bodyNorm)
      if (
        existing &&
        !window.confirm(`检测到内容已存在（标题「${existing.title}」），是否仍要添加？`)
      ) {
        return
      }
    }
    // P0-2/P0-C：组合筛选态下新建继承所有正向（OR/AND）标签，NOT 不继承；
    // 无筛选 / 无标签 / demo 视图维持原 AI 标签。
    let names = aiTags
    if (!effectiveTagFilters.untaggedOnly && !isDemoView) {
      const positiveIds = [...new Set([...effectiveTagFilters.any, ...effectiveTagFilters.all])]
      const positiveNames = positiveIds
        .map((id) => activeTags.find((tag) => tag.id === id)?.name)
        .filter((name): name is string => Boolean(name))
      if (positiveNames.length > 0) names = Array.from(new Set([...positiveNames, ...aiTags]))
    }
    const { tagIds, nextTags } = resolveTagIds(names)
    const card = createCard(body, title, names)
    setCards((prev) => [card, ...prev])
    setTags(nextTags)
    setPromptTags((prev) => setCardTags(prev, card.id, tagIds))
  }

  function handleLoadDemo() {
    if (cards.length > 0 && !window.confirm(`载入示例将【替换】当前 ${cards.length} 张卡片（非追加），确定继续？`)) {
      return
    }
    // P2-5：缓存替换前快照，10s 内可撤销回退
    const snapshotCards = cards
    const snapshotTags = tags
    const snapshotPromptTags = promptTags
    const demo = DEMO_CARDS.map((c) => ({ ...c }))
    // P0-A 关联不悬空：载入示例后按其卡片重建标签实体与关联，避免旧关联悬空
    const derived = deriveTagsFromCards(demo)
    setCards(demo)
    setTags(derived.tags)
    setPromptTags(derived.promptTags)
    setView('mine')
    resetTagFilters()
    setSelectedId(null)
    setDetailId(null)
    clearBulk()
    notifyWithUndo(`已载入 ${DEMO_CARDS.length} 张示例卡片`, () => {
      setCards(snapshotCards)
      setTags(snapshotTags)
      setPromptTags(snapshotPromptTags)
    })
  }

  function handleClearRepo() {
    if (cards.length === 0) {
      notify('仓库已经是空的')
      return
    }
    if (!window.confirm(`确定清空我的仓库（共 ${cards.length} 张卡片）？此操作不可撤销。`)) {
      return
    }
    // P2-5：缓存清空前快照，10s 内可撤销回退
    const snapshotCards = cards
    const snapshotPromptTags = promptTags
    setCards([])
    // P0-A 关联不悬空：清空卡片后一并清除全部标签关联（标签实体保留，关联归零）
    setPromptTags([])
    resetTagFilters()
    setSelectedId(null)
    setDetailId(null)
    clearBulk()
    notifyWithUndo('仓库已清空', () => {
      setCards(snapshotCards)
      setPromptTags(snapshotPromptTags)
    })
  }

  function handleSwitchView(next: ViewMode) {
    setView(next)
    resetTagFilters()
    setSelectedId(null)
    setDetailId(null)
    clearBulk()
  }

  function resetTagFilters() {
    setTagFilters((prev) => ({
      any: [],
      all: [],
      none: [],
      untaggedOnly: false,
      includeDescendants: prev.includeDescendants,
    }))
    setSelectedId(null)
    clearBulk()
  }

  /** P0-D：标签栏默认是单选切换；再次点击当前标签才取消筛选。 */
  function handleSelectTagFilter(tagId: string) {
    setTagFilters((prev) => {
      const isCurrent = prev.any.length === 1 && prev.any[0] === tagId && prev.all.length === 0 && prev.none.length === 0
      return {
        ...prev,
        any: isCurrent ? [] : [tagId],
        all: [],
        none: [],
        untaggedOnly: false,
      }
    })
    setSelectedId(null)
    clearBulk()
  }

  function handleToggleUntagged() {
    setTagFilters((prev) => ({
      any: [],
      all: [],
      none: [],
      untaggedOnly: !prev.untaggedOnly,
      includeDescendants: prev.includeDescendants,
    }))
    setSelectedId(null)
    clearBulk()
  }

  function handleIncludeDescendantsChange(includeDescendants: boolean) {
    setTagFilters((prev) => ({ ...prev, includeDescendants }))
    setSelectedId(null)
    clearBulk()
  }

  async function handleCopy(id: string) {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    let ok = false
    try {
      await navigator.clipboard.writeText(card.body)
      ok = true
    } catch {
      const ta = document.createElement('textarea')
      ta.value = card.body
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      ta.remove()
    }
    if (ok) {
      updateCard(id, (c) => ({ ...c, copyCount: c.copyCount + 1 }))
      notify('已复制到剪贴板')
    } else {
      notify('复制失败，请手动复制')
    }
  }

  function handleSaveBody(id: string, body: string, createVersion: boolean) {
    updateCard(id, (c) => (createVersion ? saveBodyWithVersion(c, body) : saveBodyOnly(c, body)))
  }

  // 编辑卡片时更新标题 + 标签（标签以名字数组传入，解析为 tag id 后原子替换关系；不存在的名字自动建实体）
  function handleUpdateMeta(id: string, title: string, tagNames: string[]) {
    const { tagIds, nextTags } = resolveTagIds(tagNames)
    // BUG-NEW-1 修复：card.tags 与 promptTags 双写一致。此前仅改 title/updatedAt，
    // chip × 移除后冗余字段残留旧标签 → UI 显示旧 chip、push 携带过期 tags。
    // 与 handleRenameTag/handleDeleteTag 对齐：以 promptTags 为真源重建 Card.tags。
    const nextPromptTags = setCardTags(promptTags, id, tagIds)
    setCards((prev) =>
      syncCardsToPromptTags(prev, nextTags, nextPromptTags).map((c) =>
        c.id === id ? { ...c, title, updatedAt: nowIso() } : c,
      ),
    )
    setTags(nextTags)
    setPromptTags(nextPromptTags)
  }

  function handleUpdateCode(id: string, code: string | null) {
    updateCard(id, (c) => ({ ...c, code, updatedAt: nowIso() }))
  }

  function handleUpdateNotes(id: string, notes: string) {
    updateCard(id, (c) => ({ ...c, notes, updatedAt: nowIso() }))
  }

  function handleRollback(id: string, versionId: string) {
    updateCard(id, (c) => rollbackToVersion(c, versionId))
  }

  function handleResetCopies(id: string) {
    updateCard(id, (c) => ({ ...c, copyCount: 0 }))
  }

  function handleSetSummary(id: string, summary: string) {
    updateCard(id, (c) => ({ ...c, thinkingSummary: summary }))
  }

  // P0-4：删除入口统一（网格直删 / PreviewPanel / CardDetail 共用）；
  // settings.confirmDelete=true 时二次确认（默认），关闭后直接删
  function handleDeleteCard(id: string) {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    if (settings.confirmDelete && !window.confirm(`确定删除「${card.title}」？此操作不可撤销。`)) return
    // P2-5：缓存删除前快照，10s 内可撤销回退
    const snapshotCards = cards
    const snapshotPromptTags = promptTags
    // P0-A 关联不悬空：删除卡片时一并清除其标签关联，避免服务端校验拒绝 / 标签计数虚高
    setCards((prev) => prev.filter((c) => c.id !== id))
    setPromptTags((prev) => prev.filter((rt) => rt.prompt_id !== id))
    setDetailId(null)
    if (selectedId === id) setSelectedId(null)
    setBulkIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    notifyWithUndo('卡片已删除', () => {
      setCards(snapshotCards)
      setPromptTags(snapshotPromptTags)
    })
  }

  // ===== 标签实体 CRUD（ID 解耦，绝不删 Prompt）=====

  /** 创建标签（管理区 + 编辑时「创建新标签」）。返回 {ok,error} 供 TagPanel 显示校验错误。 */
  function handleCreateTag(name: string, parentId: string | null): { ok: boolean; error?: string } {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: '标签名称不能为空' }
    if (trimmed.length > 50) return { ok: false, error: '标签名称不超过 50 字' }
    if (!isNameUnique(tags, parentId, trimmed)) return { ok: false, error: '同一父级下已存在同名标签' }
    // 新建标签无 tagId，不存在成环可能；只需校验父级实体存在（assertNoCycle 用于移动/已有标签）
    if (parentId !== null && !tags.some((t) => t.id === parentId)) {
      return { ok: false, error: '父标签不存在' }
    }
    const snapshot = captureTagSnapshot()
    const [nextTags, tag] = createTag(tags, trimmed, parentId)
    setTags(nextTags)
    notifyWithUndo(`已创建标签「${tag.name}」`, () => restoreTagSnapshot(snapshot))
    return { ok: true }
  }

  /** 全局重命名标签（交接 §7）：仅改 Tag.name，Prompt 与关系不动。 */
  function handleRenameTag(id: string, name: string): { ok: boolean; error?: string } {
    const trimmed = name.trim()
    const tag = tags.find((t) => t.id === id)
    if (!tag) return { ok: false, error: '标签不存在' }
    if (!trimmed) return { ok: false, error: '标签名称不能为空' }
    if (trimmed.length > 50) return { ok: false, error: '标签名称不超过 50 字' }
    if (trimmed === tag.name) return { ok: true }
    if (!isNameUnique(tags, tag.parent_id, trimmed, id)) {
      return { ok: false, error: `同一父级下已存在标签「${trimmed}」` }
    }
    const snapshot = captureTagSnapshot()
    const nextTags = renameTag(tags, id, trimmed)
    // P0-8 原子落盘：tags（仅改 Tag.name）+ promptTags（不变）+ Card.tags 冗余字段整体重建（方案 A 双写一致）
    applyTags(nextTags, promptTags)
    notifyWithUndo(`标签已重命名为「${trimmed}」`, () => restoreTagSnapshot(snapshot))
    return { ok: true }
  }

  /** 移动标签（交接 §9）：仅改 parent_id；防循环（自/子/环）。 */
  function handleMoveTag(id: string, newParentId: string | null): { ok: boolean; error?: string } {
    const tag = tags.find((t) => t.id === id)
    if (!tag) return { ok: false, error: '标签不存在' }
    if (newParentId === tag.parent_id) return { ok: true }
    if (!assertNoCycle(tags, id, newParentId)) {
      return { ok: false, error: '不能移动到自身或自己的子标签下（会形成循环）' }
    }
    if (newParentId !== null && !isNameUnique(tags, newParentId, tag.name, id)) {
      return { ok: false, error: `目标父级下已存在标签「${tag.name}」` }
    }
    const snapshot = captureTagSnapshot()
    setTags(moveTag(tags, id, newParentId))
    notifyWithUndo('标签已移动', () => restoreTagSnapshot(snapshot))
    return { ok: true }
  }

  /** P0-E：拖到标签上方/下方后同级重排；必要时同时切换父级。 */
  function handleReorderTag(id: string, targetId: string, position: 'before' | 'after'): { ok: boolean; error?: string } {
    const source = tags.find((t) => t.id === id)
    const target = tags.find((t) => t.id === targetId)
    if (!source || !target) return { ok: false, error: '标签不存在' }
    if (source.id === target.id) return { ok: true }
    if (!assertNoCycle(tags, id, target.parent_id)) {
      return { ok: false, error: '不能移动到自身或自己的子标签下（会形成循环）' }
    }
    if (!isNameUnique(tags, target.parent_id, source.name, source.id)) {
      return { ok: false, error: `目标位置同级下已存在标签「${source.name}」` }
    }
    const snapshot = captureTagSnapshot()
    setTags(reorderTag(tags, id, targetId, position))
    notifyWithUndo('标签顺序已更新', () => restoreTagSnapshot(snapshot))
    return { ok: true }
  }

  /** 删除标签（交接 §40）：级联删关系、删实体，绝不删 Prompt。
   *  @param mode self=仅删自身（子标签提升一级）/ subtree=删除整棵子树（交接 §12 模式 A/B） */
  function handleDeleteTag(id: string, mode: 'self' | 'subtree' = 'self') {
    const tag = tags.find((t) => t.id === id)
    if (!tag) return
    const snapshot = captureTagSnapshot()
    const { tags: nextTags, promptTags: nextPromptTags } = deleteTag(tags, promptTags, id, mode === 'subtree')
    applyTags(nextTags, nextPromptTags)
    const removedFilterIds = mode === 'subtree' ? new Set([id, ...collectDescendantIds(tags, id)]) : new Set([id])
    setTagFilters((prev) => ({
      ...prev,
      any: prev.any.filter((filterId) => !removedFilterIds.has(filterId)),
      all: prev.all.filter((filterId) => !removedFilterIds.has(filterId)),
      none: prev.none.filter((filterId) => !removedFilterIds.has(filterId)),
    }))
    notifyWithUndo(`已删除标签「${tag.name}」（提示词未受影响）`, () => restoreTagSnapshot(snapshot))
  }

  /** 合并标签：source 的关联 + 子标签全部转移到 target，source 删除 */
  function handleMergeTag(sourceId: string, targetId: string): { ok: boolean; error?: string } {
    const source = tags.find((t) => t.id === sourceId)
    const target = tags.find((t) => t.id === targetId)
    if (!source || !target) return { ok: false, error: '标签不存在' }
    if (sourceId === targetId) return { ok: false, error: '不能合并到自身' }
    // 防循环：target 不能是 source 的后代
    const descIds = collectDescendantIds(tags, sourceId)
    if (descIds.has(targetId)) return { ok: false, error: '不能合并到自身的子标签下（会形成循环）' }
    const targetChildNames = new Set(tags.filter((t) => t.parent_id === targetId).map((t) => t.name))
    const conflictingChild = tags.find(
      (t) => t.parent_id === sourceId && targetChildNames.has(t.name),
    )
    if (conflictingChild) {
      return { ok: false, error: `目标标签下已存在同名子标签「${conflictingChild.name}」，请先处理该子标签` }
    }
    const snapshot = captureTagSnapshot()
    const { tags: nextTags, promptTags: nextPromptTags } = mergeTags(tags, promptTags, sourceId, targetId)
    applyTags(nextTags, nextPromptTags)
    setTagFilters((prev) => {
      const sourceMode: TagFilterMode | null = prev.any.includes(sourceId)
        ? 'any'
        : prev.all.includes(sourceId)
          ? 'all'
          : prev.none.includes(sourceId)
            ? 'none'
            : null
      const next: TagFilters = {
        ...prev,
        any: prev.any.filter((id) => id !== sourceId && id !== targetId),
        all: prev.all.filter((id) => id !== sourceId && id !== targetId),
        none: prev.none.filter((id) => id !== sourceId && id !== targetId),
      }
      if (sourceMode) next[sourceMode] = [...next[sourceMode], targetId]
      return next
    })
    notifyWithUndo(`已将「${source.name}」合并到「${target.name}」`, () => restoreTagSnapshot(snapshot))
    return { ok: true }
  }

  // ===== P2-11 批量管理 =====
  function clearBulk() {
    setBulkIds(new Set())
  }

  function toggleBulk(id: string) {
    setBulkIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 批量删除：confirm + 复用 P2-5 撤销栈（10s 内一键恢复）
  function handleBulkDelete() {
    if (bulkIds.size === 0) return
    if (
      settings.confirmDelete &&
      !window.confirm(`确定删除选中的 ${bulkIds.size} 张卡片？此操作不可撤销。`)
    ) {
      return
    }
    const snapshotCards = cards
    const snapshotPromptTags = promptTags
    const ids = bulkIds
    const count = ids.size
    setCards((prev) => prev.filter((c) => !ids.has(c.id)))
    // P0-A 关联不悬空：批量删除卡片时一并清除其标签关联
    setPromptTags((prev) => prev.filter((rt) => !ids.has(rt.prompt_id)))
    if (selectedId && ids.has(selectedId)) setSelectedId(null)
    if (detailId && ids.has(detailId)) setDetailId(null)
    clearBulk()
    notifyWithUndo(`已删除 ${count} 张卡片`, () => {
      setCards(snapshotCards)
      setPromptTags(snapshotPromptTags)
    })
  }

  // 批量打标签：追加去重（不覆盖卡片已有标签），走标签实体关系
  function handleBulkTag() {
    if (bulkIds.size === 0) return
    const input = window.prompt(`为选中的 ${bulkIds.size} 张卡片添加标签（多个用逗号/顿号分隔）`)
    if (input === null) return
    const tagNames = parseTags(input)
    if (tagNames.length === 0) {
      notify('未输入有效标签')
      return
    }
    const { tagIds, nextTags } = resolveTagIds(tagNames)
    const ids = bulkIds
    // 基于当前 promptTags 计算实际变更数，再统一应用
    let changed = 0
    let nextPromptTags = promptTags
    for (const c of cards) {
      if (!ids.has(c.id)) continue
      const before = nextPromptTags.length
      for (const tid of tagIds) {
        nextPromptTags = addCardTag(nextPromptTags, c.id, tid)
      }
      if (nextPromptTags.length !== before) changed++
    }
    setTags(nextTags)
    setPromptTags(nextPromptTags)
    setCards((prev) => syncCardsToPromptTags(prev, nextTags, nextPromptTags))
    if (changed === 0) {
      notify('选中的卡片均已含这些标签，未做修改')
    } else {
      notify(`已为 ${changed} 张卡片添加标签：${tagNames.join('、')}`)
    }
  }

  // 批量移除标签：从选中卡片中移除指定标签
  function handleBulkRemoveTag() {
    if (bulkIds.size === 0) return
    const input = window.prompt(`从选中的 ${bulkIds.size} 张卡片中移除标签（多个用逗号/顿号分隔）`)
    if (input === null) return
    const tagNames = parseTags(input)
    if (tagNames.length === 0) {
      notify('未输入有效标签')
      return
    }
    // 支持完整路径消歧；只输入名称时，移除所有同名标签关系，避免层级同名时误操作。
    const tagIdsToRemove = new Set<string>()
    for (const nameOrPath of tagNames) {
      const pathMatches = tags.filter((t) => tagPath(tags, t.id) === nameOrPath)
      const matches = pathMatches.length > 0 ? pathMatches : tags.filter((t) => t.name === nameOrPath)
      for (const tag of matches) tagIdsToRemove.add(tag.id)
    }
    if (tagIdsToRemove.size === 0) {
      notify('未找到匹配的标签')
      return
    }
    const ids = bulkIds
    let changed = 0
    let nextPromptTags = promptTags
    for (const c of cards) {
      if (!ids.has(c.id)) continue
      const before = nextPromptTags.length
      for (const tid of tagIdsToRemove) {
        nextPromptTags = removeCardTag(nextPromptTags, c.id, tid)
      }
      if (nextPromptTags.length !== before) changed++
    }
    setPromptTags(nextPromptTags)
    setCards((prev) => syncCardsToPromptTags(prev, tags, nextPromptTags))
    if (changed === 0) {
      notify('选中的卡片均不含这些标签，未做修改')
    } else {
      notify(`已从 ${changed} 张卡片移除标签：${tagNames.join('、')}`)
    }
  }

  // 批量打星：0-5 整数，0 表示清零
  function handleBulkRate() {
    if (bulkIds.size === 0) return
    const input = window.prompt(
      `为选中的 ${bulkIds.size} 张卡片设置评分（0-5 整数，0 表示清零）`,
    )
    if (input === null) return
    const n = Number(input)
    if (!Number.isInteger(n) || n < 0 || n > 5) {
      notify('评分需为 0-5 的整数')
      return
    }
    const ids = bulkIds
    const count = ids.size
    setCards((prev) => prev.map((c) => (ids.has(c.id) ? { ...c, rating: n, updatedAt: nowIso() } : c)))
    notify(n === 0 ? `已清空 ${count} 张卡片的评分` : `已为 ${count} 张卡片设置 ${n} 星`)
  }

  // 批量导出：选中卡片生成 Markdown 备份
  function handleBulkExport() {
    if (bulkIds.size === 0) return
    const ids = bulkIds
    const selected = cards.filter((c) => ids.has(c.id))
    const md = buildMarkdownExport(selected)
    downloadTextFile(md, `提示词批量导出-${ids.size}张-${new Date().toISOString().slice(0, 10)}.md`)
    notify(`已导出 ${ids.size} 张卡片`)
  }

  function downloadTextFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleExport() {
    downloadTextFile(buildMarkdownExport(cards), `提示词库备份-${new Date().toISOString().slice(0, 10)}.md`)
    notify('已导出 Markdown 备份文件')
  }

  function handleImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseImport(String(reader.result ?? ''))
      if (!result.ok) {
        notify(`导入失败：${result.error}`)
        return
      }
      if (!window.confirm(`导入将覆盖当前全部 ${cards.length} 张卡片，确定继续？`)) return
      // P2-5：缓存覆盖前快照（卡片 + 设置 + 标签），10s 内可撤销回退
      const snapshotCards = cards
      const snapshotSettings = settings
      const snapshotTags = tags
      const snapshotPromptTags = promptTags
      setCards(result.cards)
      if (result.settings) setSettings(result.settings)
      // P0-A 关联不悬空：导入后按新卡片的字符串标签重建标签实体与关联
      const derived = deriveTagsFromCards(result.cards)
      setTags(derived.tags)
      setPromptTags(derived.promptTags)
      setView('mine')
      resetTagFilters()
      setSelectedId(null)
      setDetailId(null)
      clearBulk()
      // P3-5 + P2-5 合并：导入结果带详情列表 + 10s 撤销
      {
        const skipped = result.skipped ?? []
        const undo = () => {
          setCards(snapshotCards)
          setSettings(snapshotSettings)
          setTags(snapshotTags)
          setPromptTags(snapshotPromptTags)
        }
        if (skipped.length > 0) {
          undoRef.current = undo
          setToast({
            msg: `导入成功 ${result.cards.length} 张，跳过 ${skipped.length} 张`,
            detail: skipped.map((s) => `· ${s.title}：${s.reason}`),
            withUndo: true,
          })
        } else {
          notifyWithUndo(`导入成功：${result.cards.length} 张卡片`, undo)
        }
      }
    }
    reader.onerror = () => notify('读取文件失败')
    reader.readAsText(file)
  }

  useEffect(() => {
    if (view === 'demo') return
    const onKey = (e: KeyboardEvent) => {
      // 详情弹窗 / 设置弹窗打开时屏蔽全局评分快捷键，避免误触背景卡片评分
      if (detailId || showSettings) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!/^[0-5]$/.test(e.key)) return
      const rated = detailCard ?? (selectedId ? cards.find((c) => c.id === selectedId) : undefined)
      if (!rated) return
      e.preventDefault()
      handleRate(rated.id, Number(e.key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, detailCard, selectedId, cards, handleRate, detailId, showSettings])

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        view={view}
        repoCount={cards.length}
        demoCount={DEMO_CARDS.length}
        onSwitchView={handleSwitchView}
        onLoadDemo={handleLoadDemo}
        onClearRepo={handleClearRepo}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="flex min-h-0 flex-1">
        <TagPanel
          tags={activeTags}
          promptTags={activePromptTags}
          total={sourceCards.length}
          untaggedCount={untaggedCount}
          filters={effectiveTagFilters}
          onSelectTag={handleSelectTagFilter}
          onToggleUntagged={handleToggleUntagged}
          onIncludeDescendantsChange={handleIncludeDescendantsChange}
          onResetFilters={resetTagFilters}
          offline={serverOnline === false}
          onCreateTag={isDemoView ? undefined : handleCreateTag}
          onRenameTag={isDemoView ? undefined : handleRenameTag}
          onMoveTag={isDemoView ? undefined : handleMoveTag}
          onReorderTag={isDemoView ? undefined : handleReorderTag}
          onDeleteTag={isDemoView ? undefined : handleDeleteTag}
          onMergeTag={isDemoView ? undefined : handleMergeTag}
        />
        <main className="flex min-w-0 flex-1 gap-4 overflow-hidden px-5 py-4">
          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto">
            <SortBar
              mode={sortMode}
              onChange={setSortMode}
              count={visibleCards.length}
              total={baseCards.length}
              scopeLabel={tagFilterSummary || (isDemoView ? '示例知识库' : '全部')}
              search={searchQuery}
              onSearchChange={setSearchQuery}
              tagFilterSummary={tagFilterSummary}
              onClearTagFilters={resetTagFilters}
            />
            {isDemoView ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3.5 py-2.5">
                <span className="text-xs text-gold-bright">
                  正在浏览示例知识库（只读）· 共 {DEMO_CARDS.length} 张示例卡片，覆盖星级、复制统计、版本回滚与思维总结
                </span>
                <button type="button" className="btn-gold px-2.5 py-1 text-xs" onClick={handleLoadDemo}>
                  一键载入到我的仓库
                </button>
              </div>
            ) : (
              <Composer existingTags={existingTags} onCreate={handleCreate} notify={notify} />
            )}
            {!isDemoView && bulkIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2">
                <span className="text-sm text-gold-bright">已选 {bulkIds.size} 张</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="btn px-2.5 py-1 text-xs" onClick={handleBulkTag}>
                    打标签
                  </button>
                  <button type="button" className="btn px-2.5 py-1 text-xs" onClick={handleBulkRemoveTag}>
                    移除标签
                  </button>
                  <button type="button" className="btn px-2.5 py-1 text-xs" onClick={handleBulkRate}>
                    打星
                  </button>
                  <button type="button" className="btn px-2.5 py-1 text-xs" onClick={handleBulkExport}>
                    导出
                  </button>
                  <button
                    type="button"
                    className="btn px-2.5 py-1 text-xs text-rust hover:bg-rust/10"
                    onClick={handleBulkDelete}
                  >
                    删除
                  </button>
                </div>
                <span className="flex-1" />
                <button type="button" className="btn-ghost text-xs" onClick={clearBulk}>
                  取消选择
                </button>
              </div>
            )}
            {visibleCards.length === 0 ? (
              isDemoView ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-ink-900/40 px-6 py-16 text-center text-sm text-muted">
                  该标签下暂无示例卡片
                </div>
              ) : searchActive ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-ink-900/40 px-6 py-16 text-center">
                  <span className="font-serif text-lg tracking-widest text-paper-dim">未找到匹配的卡片</span>
                  <p className="max-w-sm text-sm leading-relaxed text-muted">
                    没有卡片同时满足「{debouncedQuery.trim()}」与当前标签 / 排序条件。试试其他关键词，或输入
                    @调取码 直达；可点击搜索框右侧 × 清空搜索。
                  </p>
                </div>
              ) : cards.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-ink-900/40 px-6 py-16 text-center">
                  {/* P2-7 空/离线态区分：常驻同步态横幅，避免误判「真空」与「未连上服务端」 */}
                  {!isDemoView && serverOnline === false && (
                    <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border border-rust/40 bg-rust/10 px-4 py-3">
                      <span className="text-sm font-medium text-rust">同步服务离线</span>
                      <p className="max-w-xs text-xs leading-relaxed text-muted">
                        未连接到同步服务，当前显示本机缓存（共 {cards.length} 张本地卡片）。修改不会同步到其他设备。
                      </p>
                      <button type="button" className="btn px-3 py-1 text-xs" onClick={() => void connect()}>
                        重试连接
                      </button>
                    </div>
                  )}
                  {!isDemoView && serverOnline === null && (
                    <div className="w-full max-w-sm rounded-lg border border-line bg-ink-850 px-4 py-2 text-xs text-muted">
                      正在连接同步服务…
                    </div>
                  )}
                  {!isDemoView && serverOnline === true && (
                    <div className="w-full max-w-sm text-[11px] text-muted">已连接同步服务</div>
                  )}
                  <span className="font-serif text-2xl tracking-widest text-paper-dim">提示词库还是空的</span>
                  <p className="max-w-sm text-sm leading-relaxed text-muted">
                    在上方粘贴第一条提示词正文，AI 会自动生成标题与标签，建立你的专属提示词库。
                  </p>
                  <button type="button" className="btn-gold" onClick={handleLoadDemo}>
                    或先载入示例知识库试试
                  </button>
                  <p className="text-[11px] leading-relaxed text-muted/70">
                    双击卡片进入详情 · 拖动左缘调宽，双击重置 · 选中后 1-5 打星
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-ink-900/40 px-6 py-16 text-center text-sm text-muted">
                  该标签下暂无卡片
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCards.map((card) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    query={debouncedQuery}
                    selected={selectedId === card.id}
                    readonly={isDemoView}
                    onSelect={() => setSelectedId(card.id)}
                    onOpen={() => setDetailId(card.id)}
                    onCopy={() => handleCopy(card.id)}
                    onRate={(r) => handleRate(card.id, r)}
                    onDelete={isDemoView ? undefined : handleDeleteCard}
                    bulkSelected={bulkIds.has(card.id)}
                    bulkActive={bulkIds.size > 0}
                    onBulkToggle={isDemoView ? undefined : toggleBulk}
                  />
                ))}
              </div>
            )}
          </div>
          <PreviewPanel
            key={previewCard?.id ?? 'empty'}
            card={previewCard}
            readonly={isDemoView}
            existingTags={existingTags}
            allCodes={allCodes}
            customThinkingPrompt={settings.thinkingSummaryPrompt}
            autoFormatBody={settings.autoFormatBody}
            bodyAlignment={settings.bodyAlignment}
            onCopy={() => handleCopy(previewCard?.id ?? '')}
            onRate={(r) => handleRate(previewCard?.id ?? '', r)}
            onSaveBody={handleSaveBody}
            onUpdateMeta={handleUpdateMeta}
            onUpdateCode={handleUpdateCode}
            onUpdateNotes={handleUpdateNotes}
            onResetCopies={handleResetCopies}
            onRollback={handleRollback}
            defaultWidth={420}
            onSetSummary={handleSetSummary}
            onDelete={isDemoView ? undefined : handleDeleteCard}
            onClose={() => setSelectedId(null)}
            notify={notify}
          />
        </main>
      </div>
      {detailCard && (
        <CardDetail
          card={detailCard}
          readonly={isDemoView}
          existingTags={existingTags}
          allCodes={allCodes}
          customThinkingPrompt={settings.thinkingSummaryPrompt}
          bodyAlignment={settings.bodyAlignment}
          onClose={() => setDetailId(null)}
          onSaveBody={handleSaveBody}
          onUpdateMeta={handleUpdateMeta}
          onUpdateCode={handleUpdateCode}
          onUpdateNotes={handleUpdateNotes}
          onRate={handleRate}
          onCopy={handleCopy}
          onResetCopies={handleResetCopies}
          onRollback={handleRollback}
          onSetSummary={handleSetSummary}
          onDelete={handleDeleteCard}
          notify={notify}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <Toast
        message={toast?.msg ?? null}
        detail={toast?.detail ?? null}
        action={toast?.withUndo ? { label: '撤销', onClick: handleUndo } : null}
      />
    </div>
  )
}
