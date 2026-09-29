'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Settings, SortMode, Tag, PromptTag, TagFilterMode, TagFilters } from '@/lib/types'
import { loadCards, loadSettings, loadTags, loadPromptTags, parseImport, saveCards, saveSettings, saveTags, savePromptTags, buildMarkdownExport, isServerAvailable, loadFromServer, pushToServer, subscribeSync, sanitizePromptTags, setConflictRefreshHandler, backupLocalSnapshot } from '@/lib/storage'
import { deletePromptCard, deletePromptTag, getPromptCloudSessionUser, getPromptCloudUserId, loadPromptCloudSnapshot, replacePromptCardVersions, savePromptCard, savePromptSettings, savePromptTag, subscribeToPromptCloudChanges, syncPromptCardTags, type PromptCloudSnapshot } from '@/lib/supabase/promptRepository'
import { createCard, normalizeBody, parseTags, rollbackToVersion, saveBodyOnly, saveBodyWithVersion } from '@/lib/cards'
import { DEMO_CARDS } from '@/lib/demo'
import { nowIso } from '@/lib/util'
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER } from '@/lib/ai/types'
import { TopBar } from '@/components/TopBar'
import type { ViewMode } from '@/components/DemoMenu'
import { TagPanel } from '@/components/TagPanel'
import { Composer } from '@/components/Composer'
import { SortBar } from '@/components/SortBar'
import { CardItem } from '@/components/CardItem'
import { PreviewPanel } from '@/components/PreviewPanel'
import { CardDetail } from '@/components/CardDetail'
import { SettingsModal } from '@/components/SettingsModal'
import { TrashModal } from '@/components/TrashModal'
import { Toast } from '@/components/Toast'
import { useConfirm } from '@/lib/useConfirm'
import { usePrompt } from '@/lib/usePrompt'
import { newTrashId, readTrash, writeTrash, type TrashEntry } from '@/lib/trash'
import { readPendingTagDeletes, writePendingTagDeletes } from '@/lib/tagTombstones'
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
  promptTagPathsOf,
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

/** BUG-12：把「仅存本机、远端没有」的实体并进远端快照视图。云端/legacy 写失败期间的
 * 本地编辑，此前会在加载远端快照时被无条件覆盖（2026-09-03 数据丢失事故）。合并只做
 * 按 id 增补，不改写远端已有实体；合并进视图后由持久化 effect 自动落盘并补推送。
 * `deadTagIds` = 本机待删标签 tombstone：远端与本机缓存两侧都先剔除，已删标签不得经
 * 快照回填复活（删除确认成功前，本机缓存里可能仍留着它们）。 */
function mergeLocalOnlyIntoRemoteSnapshot(
  next: Pick<PromptCloudSnapshot, 'cards' | 'tags' | 'promptTags'>,
  deadTagIds: ReadonlySet<string> = new Set<string>(),
): {
  cards: Card[]
  tags: Tag[]
  promptTags: PromptTag[]
  addedCards: number
  addedTags: number
  addedRelations: number
} {
  const localCards = loadCards()
  const localTags = loadTags().filter((tag) => !deadTagIds.has(tag.id))
  const localRelations = loadPromptTags().filter((relation) => !deadTagIds.has(relation.tag_id))
  const remoteTags = next.tags.filter((tag) => !deadTagIds.has(tag.id))
  const remoteRelations = next.promptTags.filter((relation) => !deadTagIds.has(relation.tag_id))
  const remoteCardIds = new Set(next.cards.map((card) => card.id))
  const remoteTagIds = new Set(remoteTags.map((tag) => tag.id))
  const remotePairs = new Set(remoteRelations.map((relation) => `${relation.prompt_id}\u0000${relation.tag_id}`))
  const cards = [...next.cards, ...localCards.filter((card) => !remoteCardIds.has(card.id))]
  const tags = [...remoteTags, ...localTags.filter((tag) => !remoteTagIds.has(tag.id))]
  const promptTags = [...remoteRelations, ...localRelations.filter((relation) => !remotePairs.has(`${relation.prompt_id}\u0000${relation.tag_id}`))]
  return {
    cards,
    tags,
    promptTags,
    addedCards: cards.length - next.cards.length,
    addedTags: tags.length - remoteTags.length,
    addedRelations: promptTags.length - remoteRelations.length,
  }
}

/** 仅包含 cards 表的字段；标签关联和历史版本各有独立表，不能导致卡片重复写入。 */
function cardCloudFingerprint(card: Card): string {
  return JSON.stringify({
    id: card.id,
    title: card.title,
    body: card.body,
    code: card.code,
    rating: card.rating,
    copyCount: card.copyCount,
    thinkingSummary: card.thinkingSummary,
    notes: card.notes,
    sourceUrl: card.sourceUrl,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  })
}

/** 时间戳语义比较：云端行是 Postgres 的 `+00:00` 形式，本机 state 是 `toISOString()` 的
 *  `Z` 形式，字符串不等但同一时刻。无法解析（缺失/非法）时按字符串比较结果处理。 */
function sameInstant(a: string, b: string): boolean {
  if (a === b) return true
  const left = Date.parse(a)
  const right = Date.parse(b)
  return !Number.isNaN(left) && !Number.isNaN(right) && left === right
}

/** 标签语义等价：逐字段比对，时间戳归一化后再比。写队列用「基线 vs 本机」判断是否真有
 *  改动——纯格式差异（+00:00 vs Z）不得触发云端 upsert，否则每轮空转、revision 白涨。 */
function tagsSemanticallyEqual(a: Tag, b: Tag): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    (a.parent_id ?? null) === (b.parent_id ?? null) &&
    (a.icon ?? null) === (b.icon ?? null) &&
    Boolean(a.is_pinned) === Boolean(b.is_pinned) &&
    Number(a.sort_order ?? 0) === Number(b.sort_order ?? 0) &&
    sameInstant(a.created_at, b.created_at) &&
    sameInstant(a.updated_at, b.updated_at)
  )
}

function relationsByCard(relations: PromptTag[]): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const relation of relations) {
    const ids = result.get(relation.prompt_id) ?? []
    ids.push(relation.tag_id)
    result.set(relation.prompt_id, ids)
  }
  return result
}

export default function Home() {
  const [cards, setCards] = useState<Card[]>([])
  // Composer 的 AI 补全在异步请求完成后才回调。保留最新卡片快照，避免回调闭包仍指向创建前的 cards。
  const cardsRef = useRef<Card[]>([])
  const [settings, setSettings] = useState<Settings>(() => ({
    thinkingSummaryPrompt: '',
    confirmDelete: true,
    theme: 'system',
    autoFormatBody: false,
    bodyAlignment: 'left',
    composerAddMode: 'auto',
    composerAutoTags: true,
    composerAutoTitle: true,
    hoverPreview: false,
    aiProvider: DEFAULT_AI_PROVIDER,
    aiModel: DEFAULT_AI_MODEL,
    aiApiKey: '',
    aiBaseUrl: '',
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
  const [hasCodeOnly, setHasCodeOnly] = useState(false)
  // 全局搜索（范围 A）：searchQuery 为受控输入即时值，debouncedQuery 为 300ms 防抖后的过滤依据；
  // 搜索词不持久化（刷新即清，仅 useState）
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // 回收站：本机持久化（pm:trash），删除进站、手动清空；恢复走正常保存链路重新上云。
  const [trash, setTrash] = useState<TrashEntry[]>(() => readTrash())
  const [showTrash, setShowTrash] = useState(false)
  useEffect(() => {
    writeTrash(trash)
  }, [trash])
  const [toast, setToast] = useState<{ msg: string; detail?: string[] | null; withUndo?: boolean } | null>(null)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [cloudMode, setCloudMode] = useState(false)
  // P2-7：实时同步订阅句柄，重连前先关闭旧订阅，避免 EventSource 叠加
  const syncUnsubRef = useRef<(() => void) | null>(null)
  const cloudCardsRef = useRef<Map<string, string> | null>(null)
  const cloudVersionsRef = useRef<Map<string, string> | null>(null)
  const cloudSettingsRef = useRef<string | null>(null)
  const cloudTagsRef = useRef<Map<string, string> | null>(null)
  const cloudPromptTagsRef = useRef<Map<string, string> | null>(null)
  const cloudWriteQueueRef = useRef<Promise<void>>(Promise.resolve())
  const cloudWritesInFlightRef = useRef(0)
  // 卡片的本地改动必须先落云，才允许 Realtime 整体快照覆盖本机 state。
  // 否则“本机新建 → 另一端事件到达 → 旧快照回读”会把尚未进入 effect 的新卡直接抹掉。
  const cloudCardsDirtyVersionRef = useRef(0)
  const cloudCardsSyncedVersionRef = useRef(0)
  // 标签/关联同理：本机有未落云的标签改动时，禁止 Realtime 快照整体覆盖本机 state，
  // 否则「本机删/改标签 → 快照回读」会让未落云的改动连同提示一起消失（静默失败）。
  const cloudTagsDirtyVersionRef = useRef(0)
  const cloudTagsSyncedVersionRef = useRef(0)
  // 待删标签 tombstone（`pm:pending-tag-deletes`）：本机已删、云端删除尚未确认成功的标签 id。
  // 懒加载本机持久化值（null = 尚未读取）；删除时写入、删除确认成功后清除。
  const deadTagIdsRef = useRef<Set<string> | null>(null)
  const [cloudRetryTick, setCloudRetryTick] = useState(0)
  // connect() 序列化：后发起者胜出；旧运行在 await 恢复后检测到代次变化即自行作废，
  // 消除 auth 事件并发触发 connect 时「云端分支与 legacy 分支交错」的模式摇摆（BUG-11 根因）。
  const connectGenerationRef = useRef(0)
  // 登录态下云端快照失败后的退避重连（定时器 + 尝试计数）。
  const cloudRetryTimerRef = useRef<number | null>(null)
  const cloudRetryAttemptRef = useRef(0)
  const [cloudReconnectTick, setCloudReconnectTick] = useState(0)
  // 已触发过 connect 的 auth session user id（undefined = 尚未触发过；null = 未登录）。
  const authUserIdRef = useRef<string | null | undefined>(undefined)
  // 首次水合标记：云端重试期间不重复用本机缓存覆盖用户正在查看/编辑的状态。
  const hydratedOnceRef = useRef(false)
  // P2-11 批量多选：选中卡片 id 集合（demo 视图不启用）
  const [bulkIds, setBulkIds] = useState<ReadonlySet<string>>(new Set())
  // 多选模式：由 SortBar「批量删除卡片」显式进入；未选中任何卡片时也可处于多选模式
  const [bulkMode, setBulkMode] = useState(false)
  // 跟随鼠标焦点的确认弹窗（替代浏览器原生 confirm）
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm()
  // 跟随鼠标焦点的输入弹窗（替代浏览器原生 prompt）
  const { prompt: askPrompt, dialog: promptDialog } = usePrompt()
  const undoRef = useRef<(() => void) | null>(null)
  // 标签关联失败去重：同一错误重试期间静默（仍 retryCloudSync），仅在 message 变化时再吐司。
  const lastRelationErrorRef = useRef<string | null>(null)

  const notify = useCallback((msg: string, detail?: string[]) => {
    undoRef.current = null
    setToast({ msg, detail: detail && detail.length > 0 ? detail : null })
  }, [])

  const retryCloudSync = useCallback(() => {
    window.setTimeout(() => setCloudRetryTick((value) => value + 1), 2000)
  }, [])

  /** 登录态下云端暂时不可用时的退避重连（到点重跑 connect()；新一次 connect 会先清掉待触发定时器）。 */
  const scheduleCloudReconnect = useCallback((delay: number) => {
    if (cloudRetryTimerRef.current !== null) return
    cloudRetryTimerRef.current = window.setTimeout(() => {
      cloudRetryTimerRef.current = null
      setCloudReconnectTick((value) => value + 1)
    }, delay)
  }, [])

  // supabase-js fetch 无默认超时：冲突风暴中一个未决请求会永久阻塞串行队列，
  // 后续写入（含重试补写）全部滞留且无提示（BUGS.md「写队列停摆」）。每项写入与
  // 超时竞速，超时按失败处理（提示 + 自动重试），队列继续流动；迟到的原请求若
  // 最终落库，由 revision 条件更新 / 追加式版本 / 复合主键幂等 upsert 保证安全。
  const CLOUD_WRITE_TIMEOUT_MS = 30_000

  /** 所有云端 mutation 串行执行，卡片、标签和关系不会发生竞态；单项超时防止队列停摆。 */
  const enqueueCloudWrite = useCallback((work: () => Promise<void>) => {
    const run = async () => {
      cloudWritesInFlightRef.current += 1
      let timerId: number | null = null
      try {
        await Promise.race([
          work(),
          new Promise<never>((_, reject) => {
            timerId = window.setTimeout(() => reject(new Error('cloud-write-timeout')), CLOUD_WRITE_TIMEOUT_MS)
          }),
        ])
      } catch (error) {
        const timedOut = error instanceof Error && error.message === 'cloud-write-timeout'
        notify(timedOut ? '云端写入超时，将自动重试' : '云端写入异常，将自动重试')
        retryCloudSync()
      } finally {
        if (timerId !== null) window.clearTimeout(timerId)
        cloudWritesInFlightRef.current -= 1
      }
    }
    const queued = cloudWriteQueueRef.current.then(run, run)
    cloudWriteQueueRef.current = queued.catch(() => undefined)
    return queued
  }, [notify, retryCloudSync])

  const markCardsCloudDirty = useCallback(() => {
    cloudCardsDirtyVersionRef.current += 1
  }, [])

  const hasPendingCardCloudWrite = useCallback(() => {
    return cloudCardsDirtyVersionRef.current !== cloudCardsSyncedVersionRef.current
  }, [])

  const markTagsCloudDirty = useCallback(() => {
    cloudTagsDirtyVersionRef.current += 1
  }, [])

  const hasPendingTagCloudWrite = useCallback(() => {
    return cloudTagsDirtyVersionRef.current !== cloudTagsSyncedVersionRef.current
  }, [])

  /** 本机待删标签 id 集合（tombstone）；首次访问时才读本机持久化值。 */
  const deadTagIds = useCallback((): Set<string> => {
    if (deadTagIdsRef.current === null) deadTagIdsRef.current = readPendingTagDeletes()
    return deadTagIdsRef.current
  }, [])

  /** 记一笔待删标签：删除意图必须先于云端删除落本机，供快照/缓存/派生回填时剔除。
   *  仅云端模式记录——legacy（未登录）链路的删除由 /api/sync 负责，tombstone 只服务云端。 */
  const markTagsDeleted = useCallback(
    (ids: Iterable<string>) => {
      if (!cloudMode) return
      const next = new Set(deadTagIds())
      let changed = false
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }
      if (!changed) return
      deadTagIdsRef.current = next
      writePendingTagDeletes(next)
    },
    [cloudMode, deadTagIds],
  )

  /** 清除待删标记：云端删除确认成功，或撤销/回收站把标签还原回来时调用。 */
  const clearTagDeletes = useCallback(
    (ids: Iterable<string>) => {
      const current = deadTagIds()
      if (current.size === 0) return
      const next = new Set(current)
      let changed = false
      for (const id of ids) {
        if (next.delete(id)) changed = true
      }
      if (!changed) return
      deadTagIdsRef.current = next
      writePendingTagDeletes(next)
    },
    [deadTagIds],
  )

  useEffect(() => {
    cardsRef.current = cards
  }, [cards])

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
  // BUG-11 根因修复：登录态绝不静默降级 legacy——本地有会话即锁定云端模式；
  // 快照失败进入「云端重试态」（退避重试 + UI 明示），绝不 fallback 到 /api/sync 写 legacy。
  const connect = useCallback(async () => {
    const generation = ++connectGenerationRef.current
    if (cloudRetryTimerRef.current !== null) {
      window.clearTimeout(cloudRetryTimerRef.current)
      cloudRetryTimerRef.current = null
    }
    if (syncUnsubRef.current) {
      syncUnsubRef.current()
      syncUnsubRef.current = null
    }
    setServerOnline(null)
    const markHydrated = () => {
      hydratedOnceRef.current = true
      setHydrated(true)
    }
    const applyCloud = (next: PromptCloudSnapshot, options?: { force?: boolean }) => {
      // 不用旧快照覆盖仍未落云的本机卡片/标签；等待写队列完成后由 Realtime 重新读取。
      // force 仅在云端基线尚未建立时使用（如重连后的首次快照）：此时不存在需要保护的写队列。
      if (!options?.force && (hasPendingCardCloudWrite() || hasPendingTagCloudWrite())) return false
      // BUG-12：仅存本机的实体并入视图（基线仍取远端快照，使其成为待推送增量），
      // 避免云端写失败期间的本地编辑被快照覆盖；tombstone 里的待删标签两侧都剔除。
      const merged = mergeLocalOnlyIntoRemoteSnapshot(next, deadTagIds())
      setCards(merged.cards)
      setSettings(next.settings ?? loadSettings())
      setTags(merged.tags)
      setPromptTags(merged.promptTags)
      cloudCardsRef.current = new Map(next.cards.map((card) => [card.id, cardCloudFingerprint(card)]))
      cloudVersionsRef.current = new Map(next.cards.map((card) => [card.id, JSON.stringify(card.versions)]))
      cloudSettingsRef.current = JSON.stringify(next.settings ?? loadSettings())
      cloudTagsRef.current = new Map(next.tags.map((tag) => [tag.id, JSON.stringify(tag)]))
      cloudPromptTagsRef.current = new Map(next.promptTags.map((relation) => [`${relation.prompt_id}\u0000${relation.tag_id}`, JSON.stringify(relation)]))
      cloudCardsSyncedVersionRef.current = cloudCardsDirtyVersionRef.current
      // 标签基线建立/整体覆盖时对齐。
      // 注意：基线刻意取**未过滤**的 next.tags（云端真实行），tombstone 只过滤视图；
      // 这样待删标签仍留在基线里，下一轮写 effect 由「基线有、本机无」自然发起真删除。
      cloudTagsSyncedVersionRef.current = cloudTagsDirtyVersionRef.current
      if (merged.addedCards > 0 || merged.addedTags > 0 || merged.addedRelations > 0) {
        const parts = [
          merged.addedCards > 0 ? `卡片 ${merged.addedCards} 张` : null,
          merged.addedTags > 0 ? `标签 ${merged.addedTags} 个` : null,
          merged.addedRelations > 0 ? `标签关联 ${merged.addedRelations} 条` : null,
        ].filter(Boolean)
        notify(`已找回仅存本机的数据并开始同步：${parts.join('、')}`)
      }
      return true
    }

    // 登录态探测：本地会话存在即视为已登录。getUser 的瞬时失败（如令牌刷新遇到网络抖动）
    // 只说明云端暂不可用，不得把已登录用户降级到未登录链路。
    const auth = await getPromptCloudSessionUser()
    if (generation !== connectGenerationRef.current) return

    if (auth.signedIn) {
      let cloud: PromptCloudSnapshot | null = null
      try {
        cloud = await loadPromptCloudSnapshot(loadSettings().aiApiKey)
      } catch {
        cloud = null
      }
      if (generation !== connectGenerationRef.current) return
      if (cloud) {
        // 登录 + 空库（hasCloudData=false）同样保持云端模式：等待用户显式导入，绝不落入 legacy。
        const baselineWasAbsent = cloudCardsRef.current === null
        const hadPendingLocalEdits = hasPendingCardCloudWrite()
        // BUG-12：云端快照覆盖本机视图前，先滚动备份 localStorage（尽力而为）。
        backupLocalSnapshot()
        applyCloud(cloud, { force: baselineWasAbsent })
        cloudRetryAttemptRef.current = 0
        setCloudMode(true)
        setServerOnline(true)
        syncUnsubRef.current = subscribeToPromptCloudChanges(() => {
          // 本机写入会回显为 Realtime 事件；等待当前队列清空后再读取，避免
          // 读到半完成快照覆盖正在编辑的本地状态。
          const refresh = () => {
            if (cloudWritesInFlightRef.current > 0 || hasPendingCardCloudWrite() || hasPendingTagCloudWrite()) {
              window.setTimeout(refresh, 300)
              return
            }
            void loadPromptCloudSnapshot(loadSettings().aiApiKey)
              .then((latest) => {
                if (latest?.hasCloudData) applyCloud(latest)
              })
              .catch(() => {
                // 单次回读失败（如令牌瞬断）不改变连接状态；下一个 Realtime 事件会再次触发回读。
              })
          }
          window.setTimeout(refresh, 250)
        })
        markHydrated()
        if (baselineWasAbsent && hadPendingLocalEdits) {
          notify('云端连接已恢复；离线期间的本地修改未上传云端，仍保留在本机缓存')
        }
        return
      }
      // 登录态有效但云端暂时不可用：保持在云端模式 + 退避重试，绝不静默降级 legacy，
      // 也绝不通过 /api/sync 写入局域网共享存储。
      setCloudMode(true)
      setServerOnline(false)
      if (!hydratedOnceRef.current) {
        // 首屏即遇云端不可用：先用本机缓存呈现，避免白屏；后续重试不再覆盖用户正在编辑的状态。
        // 本机缓存可能仍留着待删标签，读缓存时同样按 tombstone 剔除（同 applyCloud）。
        const dead = deadTagIds()
        setCards(loadCards())
        setSettings(loadSettings())
        setTags(loadTags().filter((tag) => !dead.has(tag.id)))
        setPromptTags(loadPromptTags().filter((relation) => !dead.has(relation.tag_id)))
        markHydrated()
      }
      if (cloudRetryAttemptRef.current === 0) {
        notify('云端暂时不可用，已保持在云端模式并自动重试；期间修改仅保存在本机缓存')
      }
      cloudRetryAttemptRef.current += 1
      scheduleCloudReconnect(Math.min(30000, 2000 * 2 ** Math.min(cloudRetryAttemptRef.current - 1, 4)))
      return
    }

    // 未登录：走旧的局域网同步链路（兼容层保持不变；仅退出登录才进入此分支）。
    cloudRetryAttemptRef.current = 0
    setCloudMode(false)
    // 清空云端基线与待同步代次，避免下次登录复用上一账号的指纹导致写队列误判。
    cloudCardsRef.current = null
    cloudVersionsRef.current = null
    cloudSettingsRef.current = null
    cloudTagsRef.current = null
    cloudPromptTagsRef.current = null
    cloudCardsDirtyVersionRef.current = 0
    cloudCardsSyncedVersionRef.current = 0
    cloudTagsDirtyVersionRef.current = 0
    cloudTagsSyncedVersionRef.current = 0
    const serverOk = await isServerAvailable()
    if (generation !== connectGenerationRef.current) return
    if (!serverOk) {
      // 离线兜底：使用本机 localStorage 数据（待删标签同样按 tombstone 剔除）
      setServerOnline(false)
      const dead = deadTagIds()
      setCards(loadCards())
      setSettings(loadSettings())
      setTags(loadTags().filter((tag) => !dead.has(tag.id)))
      setPromptTags(loadPromptTags().filter((relation) => !dead.has(relation.tag_id)))
      markHydrated()
      notify('未连接同步服务，已使用本机本地数据（不同步）')
      return
    }
    const remote = await loadFromServer()
    if (generation !== connectGenerationRef.current) return
    if (!remote) {
      setServerOnline(false)
      markHydrated()
      return
    }
    setServerOnline(true)
    // BUG-12：应用 legacy 快照覆盖本机视图前，先滚动备份 localStorage（尽力而为）。
    backupLocalSnapshot()
    // 服务端为空但本机有数据：首次迁移上传，避免两边永远为空
    if (remote.cards.length === 0) {
      const local = loadCards()
      if (local.length > 0) {
        const localTags = loadTags()
        const localPromptTags = loadPromptTags()
        await pushToServer(local, loadSettings(), localTags, localPromptTags)
        if (generation !== connectGenerationRef.current) return
        setCards(local)
        setSettings(loadSettings())
        setTags(localTags)
        setPromptTags(sanitizePromptTags(localPromptTags, local, localTags))
      }
    } else {
      // 本地 SQLite 模式：服务器是唯一事实来源，直接用服务器数据覆盖 localStorage 残留。
      // （旧 mergeLocalOnlyIntoRemoteSnapshot 在 Supabase→SQLite 迁移时会把旧 UUID 卡片并入导致重复）
      const dead = deadTagIds()
      setCards(remote.cards)
      setSettings(remote.settings)
      setTags(remote.tags.filter((tag) => !dead.has(tag.id)))
      setPromptTags(remote.promptTags.filter((relation) => !dead.has(relation.tag_id)))
    }
    // 订阅实时同步：另一台电脑改动时自动拉取最新数据
    syncUnsubRef.current = subscribeSync((rc, rs, rt, rpt) => {
      // tombstone 过滤同 applyCloud：删除确认成功前，实时推送不得把待删标签/关系回填进视图。
      const dead = deadTagIds()
      setCards(rc)
      setSettings(rs)
      setTags(rt.filter((tag) => !dead.has(tag.id)))
      setPromptTags(rpt.filter((relation) => !dead.has(relation.tag_id)))
    })
    markHydrated()
  }, [hasPendingCardCloudWrite, hasPendingTagCloudWrite, deadTagIds, notify, scheduleCloudReconnect])

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
      if (cloudRetryTimerRef.current !== null) {
        window.clearTimeout(cloudRetryTimerRef.current)
        cloudRetryTimerRef.current = null
      }
    }
  }, [connect])

  // 云端退避重连到点后重跑 connect()（经计时器绕行，避免 effect 同步体内 setState）。
  useEffect(() => {
    if (cloudReconnectTick === 0) return
    const timer = window.setTimeout(() => {
      void connect()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [cloudReconnectTick, connect])

  useEffect(() => {
    const onAuthChanged = (event: Event) => {
      // 按 session user id 去抖：同一用户的重复 auth 事件不重建数据连接；
      // 仅登录 / 退出 / 换号（user id 变化）时重跑 connect()。
      const userId = (event as CustomEvent<{ userId?: string | null }>).detail?.userId ?? null
      if (authUserIdRef.current !== undefined && authUserIdRef.current === userId) return
      authUserIdRef.current = userId
      void connect()
    }
    window.addEventListener('prompt-manager-auth-changed', onAuthChanged)
    return () => window.removeEventListener('prompt-manager-auth-changed', onAuthChanged)
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
    if (!cloudMode) return
    const nextCards = new Map(cards.map((card) => [card.id, cardCloudFingerprint(card)]))
    const nextVersions = new Map(cards.map((card) => [card.id, JSON.stringify(card.versions)]))
    const writeVersion = cloudCardsDirtyVersionRef.current
    void enqueueCloudWrite(async () => {
      const previousCards = cloudCardsRef.current
      const previousVersions = cloudVersionsRef.current
      if (!previousCards || !previousVersions) return

      for (const card of cards) {
        if (previousCards.get(card.id) !== nextCards.get(card.id)) {
          const result = await savePromptCard(card)
          if (!result.ok) {
            notify(`云端卡片保存失败：${result.message}`)
            retryCloudSync()
            return
          }
        }
        if (previousVersions.get(card.id) !== nextVersions.get(card.id)) {
          const result = await replacePromptCardVersions(card)
          if (!result.ok) {
            notify(`云端历史版本保存失败：${result.message}`)
            retryCloudSync()
            return
          }
        }
      }
      for (const id of previousCards.keys()) {
        if (nextCards.has(id)) continue
        const result = await deletePromptCard(id)
        if (!result.ok) {
          notify(`云端卡片删除失败：${result.message}`)
          retryCloudSync()
          return
        }
      }
      cloudCardsRef.current = nextCards
      cloudVersionsRef.current = nextVersions
      // 仅确认本轮开始前已经发生的本地改动；等待期间又编辑时仍保持 dirty，避免放开快照覆盖。
      if (cloudCardsDirtyVersionRef.current === writeVersion) {
        cloudCardsSyncedVersionRef.current = writeVersion
      }
    })
  }, [cards, cloudMode, cloudRetryTick, enqueueCloudWrite, hydrated, notify, retryCloudSync])

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
    if (!hydrated) return
    saveSettings(settings)
    if (!cloudMode) return
    if (cloudSettingsRef.current === null) return
    // 云端基线未加载（如云端暂时不可用）前不上传设置，避免把本机缓存覆盖到云端。
    const serialized = JSON.stringify(settings)
    if (cloudSettingsRef.current === serialized) return
    void enqueueCloudWrite(async () => {
      if (cloudSettingsRef.current === serialized) return
      const userId = await getPromptCloudUserId()
      if (!userId) {
        notify('云端设置未保存：登录状态已失效')
        return
      }
      const result = await savePromptSettings(settings, userId)
      if (!result.ok) {
        notify(`云端设置保存失败：${result.message}`)
        retryCloudSync()
        return
      }
      cloudSettingsRef.current = serialized
    })
  }, [settings, cloudMode, cloudRetryTick, enqueueCloudWrite, hydrated, notify, retryCloudSync])

  useEffect(() => {
    if (hydrated) saveTags(tags)
  }, [tags, hydrated])

  useEffect(() => {
    if (!hydrated || !cloudMode) return
    const nextTags = new Map(tags.map((tag) => [tag.id, JSON.stringify(tag)]))
    const nextRelations = new Map(promptTags.map((relation) => [`${relation.prompt_id}\u0000${relation.tag_id}`, JSON.stringify(relation)]))
    const writeVersion = cloudTagsDirtyVersionRef.current
    void enqueueCloudWrite(async () => {
      const previousTags = cloudTagsRef.current
      const previousRelations = cloudPromptTagsRef.current
      if (!previousTags || !previousRelations) return
      // 基线**逐实体推进**：某条标签保存成功即写该 id 的基线。整轮失败不再回滚已确认的
      // 部分，否则重试时会把「云端已删」的标签又当成待保存项，或让已删项反复复活。
      for (const tag of tags) {
        // 基线可能来自云端行（`+00:00` 时间戳），本机 state 是 ISO `Z`：直接比字符串会因纯
        // 格式差异永远不等，导致每轮重复 upsert（revision 空转）且 hasPendingTagCloudWrite
        // 永真、Realtime 快照被永久挡在门外。故逐字段语义比较。
        const previousSerialized = previousTags.get(tag.id)
        if (previousSerialized !== undefined && tagsSemanticallyEqual(JSON.parse(previousSerialized) as Tag, tag)) continue
        const result = await savePromptTag(tag)
        if (!result.ok) {
          notify(`云端标签保存失败：${result.message}`)
          retryCloudSync()
          return
        }
        cloudTagsRef.current?.set(tag.id, nextTags.get(tag.id) ?? JSON.stringify(tag))
      }
      const previousByCard = relationsByCard(
        [...previousRelations.values()].map((serialized) => JSON.parse(serialized) as PromptTag),
      )
      const nextByCard = relationsByCard(promptTags)
      const changedCardIds = new Set([...previousByCard.keys(), ...nextByCard.keys()])
      for (const cardId of changedCardIds) {
        const previousIds = previousByCard.get(cardId) ?? []
        const nextIds = nextByCard.get(cardId) ?? []
        if (JSON.stringify(previousIds) === JSON.stringify(nextIds)) continue
        const card = cardsRef.current.find((item) => item.id === cardId)
        if (!card) {
          // 仅纯删除残留（nextIds 为空，卡片已删、只剩待清关联）可跳过；
          // 仍有待写关联却找不到卡片属异常，按失败处理且不推进基线，避免静默永久分叉。
          if (nextIds.length === 0) continue
          const missingCardMessage = '云端标签关联保存失败：目标卡片不存在'
          if (lastRelationErrorRef.current !== missingCardMessage) {
            lastRelationErrorRef.current = missingCardMessage
            notify(missingCardMessage)
          }
          retryCloudSync()
          return
        }
        const result = await syncPromptCardTags(card, previousIds, nextIds, tags)
        if (!result.ok) {
          // 父行补推已在 syncPromptCardTags 内同 job 完成，此处只负责提示 + 重试。
          const relationMessage = `云端标签关联保存失败：${result.message}`
          if (lastRelationErrorRef.current !== relationMessage) {
            lastRelationErrorRef.current = relationMessage
            notify(relationMessage)
          }
          retryCloudSync()
          return
        }
      }
      lastRelationErrorRef.current = null
      // 删除集合 = 云端基线里有、本机已无的标签 ∪ 本机 tombstone（曾是本机标签、云端删除
      // 还没确认成功的 id）。后者包含「从未进过云端基线」的删除——这类删除过去会被上面的
      // 防御检查拦下、直接真删才是正解：deletePromptTag 的 0 行复核把「行已不存在 / 非本
      // 用户」按成功处理，只有确认「行仍存在且删不掉」才报错，因此不会误报也不会死循环。
      const deleteIds = new Set<string>()
      for (const tagId of previousTags.keys()) {
        if (!nextTags.has(tagId)) deleteIds.add(tagId)
      }
      for (const tagId of deadTagIds()) {
        if (!nextTags.has(tagId)) deleteIds.add(tagId)
      }
      for (const tagId of deleteIds) {
        try {
          const result = await deletePromptTag(tagId)
          if (!result.ok) {
            notify(`云端标签删除失败：${result.message}`)
            retryCloudSync()
            return
          }
        } catch (error) {
          notify(`云端标签删除异常：${error instanceof Error ? error.message : String(error)}`)
          retryCloudSync()
          return
        }
        // 删除确认成功：基线逐实体移除该行、tombstone 同步清除。
        cloudTagsRef.current?.delete(tagId)
        clearTagDeletes([tagId])
      }
      cloudPromptTagsRef.current = nextRelations
      // 仅确认本轮开始前已经发生的本机标签改动；等待期间又改动时仍保持 dirty，避免放开快照覆盖。
      if (cloudTagsDirtyVersionRef.current === writeVersion) {
        cloudTagsSyncedVersionRef.current = writeVersion
      }
    })
  }, [tags, promptTags, cloudMode, cloudRetryTick, enqueueCloudWrite, hydrated, notify, retryCloudSync, deadTagIds, clearTagDeletes])

  useEffect(() => {
    if (hydrated) savePromptTags(promptTags)
  }, [promptTags, hydrated])

  const updateCard = useCallback((id: string, patch: (c: Card) => Card) => {
    markCardsCloudDirty()
    setCards((prev) => prev.map((c) => (c.id === id ? patch(c) : c)))
  }, [markCardsCloudDirty])

  const handleRate = useCallback((id: string, rating: number) => {
    updateCard(id, (c) => ({ ...c, rating }))
  }, [updateCard])

  // 活跃的 tags/promptTags 真源：demo 视图从 DEMO_CARDS 派生；mine 视图用服务端/本地 state；
  // 若 mine 视图 tags 为空但卡片仍有字符串标签（未迁移旧数据），兜底派生避免标签消失。
  // 派生结果同样按 tombstone 剔除：已删标签不得经兜底派生重新长回来。
  const activeTagData = useMemo(() => {
    if (isDemoView) return deriveTagsFromCards(DEMO_CARDS)
    if (tags.length === 0 && cards.some((c) => c.tags.length > 0)) {
      const derived = deriveTagsFromCards(cards)
      const dead = deadTagIds()
      return {
        tags: derived.tags.filter((tag) => !dead.has(tag.id)),
        promptTags: derived.promptTags.filter((relation) => !dead.has(relation.tag_id)),
      }
    }
    return { tags, promptTags }
  }, [isDemoView, tags, promptTags, cards, deadTagIds])
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

  // 卡片标签展示串：关联 id → 完整路径（父/子），同名不同父一眼区分；无关联时回退 card.tags 冗余名
  const cardTagLabels = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const card of cards) {
      const paths = promptTagPathsOf(tags, promptTags, card.id)
      map.set(card.id, paths.length > 0 ? paths : card.tags)
    }
    return map
  }, [cards, tags, promptTags])

  // 无标签卡片数（未与任何标签建立关联的卡片）
  const untaggedCount = useMemo(() => {
    const linked = new Set(activePromptTags.map((rt) => rt.prompt_id))
    return sourceCards.filter((c) => !linked.has(c.id)).length
  }, [sourceCards, activePromptTags])

  const allCodes = useMemo(
    () => cards.map((c) => c.code).filter((c): c is string => Boolean(c)),
    [cards],
  )

  // 过滤链三段：baseCards（视图 + 组合标签 + 调取码）→ 搜索过滤（AND 叠加）→ 排序。
  // 三组条件之间也是 AND：(any 命中任一) AND (all 逐个命中) AND (none 全部不命中)。
  const baseCards = useMemo(() => {
    if (effectiveTagFilters.untaggedOnly) {
      const linked = new Set(activePromptTags.map((rt) => rt.prompt_id))
      return sourceCards.filter((c) => !linked.has(c.id) && (!hasCodeOnly || Boolean(c.code?.trim())))
    }
    const hasTagConditions =
      effectiveTagFilters.any.length + effectiveTagFilters.all.length + effectiveTagFilters.none.length > 0
    if (!hasTagConditions) return hasCodeOnly ? sourceCards.filter((card) => Boolean(card.code?.trim())) : sourceCards

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
      return passesAny && passesAll && passesNone && (!hasCodeOnly || Boolean(card.code?.trim()))
    })
  }, [sourceCards, effectiveTagFilters, activeTags, activePromptTags, hasCodeOnly])

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
   *  「父/子/孙」路径：名称含「/」时优先按斜杠逐级解析父子层级（复用已存在父级、缺失则创建），
   *  卡片关联到叶子标签；若存在历史遗留的整串扁平标签（如「自动化/每日」，Bug #2 残留），
   *  将其关联并入层级叶子并删除扁平实体。返回 tagIds（去重、保持顺序、trim）与扩展后的 tags、promptTags。 */
  function resolveTagIds(
    names: string[],
    promptTags: PromptTag[],
  ): { tagIds: string[]; nextTags: Tag[]; nextPromptTags: PromptTag[] } {
    let nextTags = tags
    let nextPromptTags = promptTags
    const tagIds: string[] = []
    const seen = new Set<string>()
    for (const raw of names) {
      const name = raw.trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      let found: Tag | undefined
      // 含斜杠：优先按「父/子/孙」路径解析——避免历史遗留的整串扁平标签遮蔽层级创建
      if (name.includes('/')) {
        const parts = name.split('/').map((p) => p.trim()).filter(Boolean)
        if (parts.length >= 2 && parts.every((p) => p.length <= 50)) {
          let parentId: string | null = null
          for (const part of parts) {
            const node = nextTags.find((t) => t.parent_id === parentId && t.name === part)
            if (node) {
              found = node
            } else {
              const [updated, created] = createTag(nextTags, part, parentId)
              nextTags = updated
              found = created
            }
            parentId = found.id
          }
          const leaf = found as Tag
          // 迁移历史扁平残留：整串同名的顶级扁平标签（且无子标签）并入层级叶子，再删除扁平实体
          const legacy = nextTags.find((t) => t.parent_id === null && t.name === name)
          if (legacy && legacy.id !== leaf.id && nextTags.every((t) => t.parent_id !== legacy.id)) {
            nextPromptTags = nextPromptTags.map((rt) =>
              rt.tag_id === legacy.id ? { ...rt, tag_id: leaf.id } : rt,
            )
            // 去重：同一 prompt 可能已关联叶子标签，避免 (prompt_id, tag_id) 重复
            const seenPair = new Set<string>()
            const deduped: PromptTag[] = []
            for (const rt of nextPromptTags) {
              const key = `${rt.prompt_id}\u0000${rt.tag_id}`
              if (seenPair.has(key)) continue
              seenPair.add(key)
              deduped.push(rt)
            }
            nextPromptTags = deduped
            nextTags = nextTags.filter((t) => t.id !== legacy.id)
          }
        } else {
          // 路径非法（空段 / 超长）：回退匹配已有标签（顶级优先，其次任意父级）——兼容历史遗留扁平名
          found =
            nextTags.find((t) => t.parent_id === null && t.name === name) ??
            nextTags.find((t) => t.name === name)
        }
      } else {
        // 无斜杠：优先匹配已有标签（顶级优先，其次任意父级）
        found =
          nextTags.find((t) => t.parent_id === null && t.name === name) ??
          nextTags.find((t) => t.name === name)
      }
      if (!found) {
        const [updated, created] = createTag(nextTags, name, null)
        nextTags = updated
        found = created
      }
      tagIds.push(found.id)
    }
    return { tagIds, nextTags, nextPromptTags }
  }

  /** 标签集合原子落盘：更新 tags + promptTags 后，同步重建所有卡片的 Card.tags 冗余字段 */
  function applyTags(nextTags: Tag[], nextPromptTags: PromptTag[]) {
    // 标签/关联有本机改动待落云：期间禁止 Realtime 快照整体覆盖本机 state。
    markTagsCloudDirty()
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
    // 撤销整体回退标签集合：先标脏（否则 Realtime 快照会把回退结果直接盖掉），
    // 再清掉这些 id 的待删 tombstone——标签既然被还原，就不再是「待删」。
    markTagsCloudDirty()
    clearTagDeletes(snap.tags.map((tag) => tag.id))
    setCards(snap.cards)
    setTags(snap.tags)
    setPromptTags(snap.promptTags)
    setTagFilters(snap.tagFilters)
  }

  async function handleCreate(body: string, title: string, aiTags: string[]): Promise<string | null> {
    // P0-3 重复内容去重：normalizeBody 全等比对（大小写敏感、空白归一后），命中首个提示二次确认；
    // 空内容（bodyNorm 为空）不触发
    const bodyNorm = normalizeBody(body.trim())
    if (bodyNorm) {
      const existing = cards.find((c) => normalizeBody(c.body.trim()) === bodyNorm)
      if (
        existing &&
        !(await askConfirm({
          title: `检测到内容已存在（标题「${existing.title}」），是否仍要添加？`,
        }))
      ) {
        return null
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
    const { tagIds, nextTags, nextPromptTags } = resolveTagIds(names, promptTags)
    const card = createCard(body, title, names)
    markCardsCloudDirty()
    setCards((prev) => {
      const nextCards = [card, ...prev]
      cardsRef.current = nextCards
      return nextCards
    })
    setTags(nextTags)
    setPromptTags(() => setCardTags(nextPromptTags, card.id, tagIds))
    return card.id
  }

  /** Composer 后台补全：只填仍处于初始状态的字段，避免覆盖用户刚完成的手动编辑。 */
  function handleApplyGeneratedMeta(id: string, title: string, tagNames: string[], generateTitle: boolean, generateTags: boolean) {
    const card = cardsRef.current.find((item) => item.id === id)
    if (!card) return
    const nextTitle = generateTitle && card.title === '未命名提示词' ? title : card.title
    const nextTagNames = generateTags ? Array.from(new Set([...card.tags, ...tagNames])) : card.tags
    handleUpdateMeta(id, nextTitle, nextTagNames)
  }

  /** Composer 三个开关写入全局 settings（经 settings effect 自动持久化到 localStorage + 服务器）。 */
  function handleComposerOptionsChange(patch: { autoTags?: boolean; autoTitle?: boolean; autoFormat?: boolean }) {
    setSettings((prev) => ({
      ...prev,
      ...(patch.autoTags !== undefined ? { composerAutoTags: patch.autoTags } : null),
      ...(patch.autoTitle !== undefined ? { composerAutoTitle: patch.autoTitle } : null),
      ...(patch.autoFormat !== undefined ? { autoFormatBody: patch.autoFormat } : null),
    }))
  }

  async function handleLoadDemo() {
    if (
      cards.length > 0 &&
      !(await askConfirm({
        title: `载入示例将【替换】当前 ${cards.length} 张卡片（非追加），确定继续？`,
        danger: true,
      }))
    ) {
      return
    }
    // P2-5：缓存替换前快照，10s 内可撤销回退
    const snapshotCards = cards
    const snapshotTags = tags
    const snapshotPromptTags = promptTags
    const demo = DEMO_CARDS.map((c) => ({ ...c }))
    // P0-A 关联不悬空：载入示例后按其卡片重建标签实体与关联，避免旧关联悬空
    const derived = deriveTagsFromCards(demo)
    markCardsCloudDirty()
    setCards(demo)
    setTags(derived.tags)
    setPromptTags(derived.promptTags)
    setView('mine')
    resetTagFilters()
    setSelectedId(null)
    setDetailId(null)
    exitBulkMode()
    notifyWithUndo(`已载入 ${DEMO_CARDS.length} 张示例卡片`, () => {
      markCardsCloudDirty()
      setCards(snapshotCards)
      setTags(snapshotTags)
      setPromptTags(snapshotPromptTags)
    })
  }

  async function handleClearRepo() {
    if (cards.length === 0) {
      notify('仓库已经是空的')
      return
    }
    if (
      !(await askConfirm({
        title: `确定清空我的仓库（共 ${cards.length} 张卡片）？`,
        description: '此操作不可撤销。',
        danger: true,
      }))
    ) {
      return
    }
    // P2-5：缓存清空前快照，10s 内可撤销回退
    const snapshotCards = cards
    const snapshotPromptTags = promptTags
    markCardsCloudDirty()
    setCards([])
    // P0-A 关联不悬空：清空卡片后一并清除全部标签关联（标签实体保留，关联归零）
    setPromptTags([])
    resetTagFilters()
    setSelectedId(null)
    setDetailId(null)
    exitBulkMode()
    notifyWithUndo('仓库已清空', () => {
      markCardsCloudDirty()
      setCards(snapshotCards)
      setPromptTags(snapshotPromptTags)
    })
  }

  function handleSwitchView(next: ViewMode) {
    setView(next)
    resetTagFilters()
    setSelectedId(null)
    setDetailId(null)
    exitBulkMode()
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
    const { tagIds, nextTags, nextPromptTags: migratedPromptTags } = resolveTagIds(tagNames, promptTags)
    // BUG-NEW-1 修复：card.tags 与 promptTags 双写一致。此前仅改 title/updatedAt，
    // chip × 移除后冗余字段残留旧标签 → UI 显示旧 chip、push 携带过期 tags。
    // 与 handleRenameTag/handleDeleteTag 对齐：以 promptTags 为真源重建 Card.tags。
    const nextPromptTags = setCardTags(migratedPromptTags, id, tagIds)
    markCardsCloudDirty()
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

  function handleUpdateSourceUrl(id: string, sourceUrl: string) {
    updateCard(id, (c) => ({ ...c, sourceUrl, updatedAt: nowIso() }))
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

  /** 回收站入站（本机快照；调用方继续走原删除流程硬删云端行） */
  function pushTrash(entry: TrashEntry) {
    setTrash((prev) => [entry, ...prev].slice(0, 100))
  }

  /** 从回收站恢复一条：仅补回缺失的 id，已存在的跳过（与 10s 撤销共存不翻倍） */
  function handleRestoreTrash(entryId: string) {
    if (isDemoView) {
      notify('请先切回「我的仓库」再恢复')
      return
    }
    const entry = trash.find((e) => e.id === entryId)
    if (!entry) return
    if (entry.kind === 'card') {
      const haveCardIds = new Set(cards.map((c) => c.id))
      const missingCards = entry.cards.filter((c) => !haveCardIds.has(c.id))
      const havePairs = new Set(promptTags.map((rt) => `${rt.prompt_id}\u0000${rt.tag_id}`))
      const missingRelations = entry.relations.filter(
        (rt) => !havePairs.has(`${rt.prompt_id}\u0000${rt.tag_id}`),
      )
      if (missingCards.length === 0 && missingRelations.length === 0) {
        notify('该内容已在仓库中，无需恢复')
        return
      }
      markCardsCloudDirty()
      const restoredCards = [...missingCards, ...cards]
      const restoredRelations = [...promptTags, ...missingRelations]
      setCards(syncCardsToPromptTags(restoredCards, tags, restoredRelations))
      setPromptTags(restoredRelations)
      notify(
        missingCards.length > 0
          ? `已恢复卡片「${missingCards[0].title}」等 ${missingCards.length} 张`
          : '关联已恢复',
      )
    } else {
      const haveTagIds = new Set(tags.map((t) => t.id))
      const missingTags = entry.tags.filter((t) => !haveTagIds.has(t.id))
      if (missingTags.length === 0) {
        notify('这些标签已在仓库中，无需恢复')
        return
      }
      // 父级若已不在（后删的）：挂回顶级，避免悬空
      const knownIds = new Set([...haveTagIds, ...missingTags.map((t) => t.id)])
      const fixedTags = missingTags.map((t) =>
        t.parent_id !== null && !knownIds.has(t.parent_id) ? { ...t, parent_id: null } : t,
      )
      const havePairs = new Set(promptTags.map((rt) => `${rt.prompt_id}\u0000${rt.tag_id}`))
      const restoringIds = new Set(fixedTags.map((t) => t.id))
      // 回收站恢复等同撤销删除：清掉这些 id 的待删 tombstone，否则恢复出来的标签会被回填剔除。
      clearTagDeletes(restoringIds)
      const missingRelations = entry.relations.filter(
        (rt) => restoringIds.has(rt.tag_id) && !havePairs.has(`${rt.prompt_id}\u0000${rt.tag_id}`),
      )
      applyTags([...tags, ...fixedTags], [...promptTags, ...missingRelations])
      notify(
        `已恢复标签「${fixedTags.map((t) => t.name).slice(0, 3).join('、')}${fixedTags.length > 3 ? `等 ${fixedTags.length} 个` : ''}」`,
      )
    }
  }

  function handleEmptyTrash() {
    setTrash([])
    notify('回收站已清空')
  }

  // P0-4：删除入口统一（网格直删 / PreviewPanel / CardDetail 共用）；
  // settings.confirmDelete=true 时二次确认（默认），关闭后直接删
  async function handleDeleteCard(id: string) {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    if (
      settings.confirmDelete &&
      !(await askConfirm({
        title: `确定删除「${card.title}」？`,
        description: '可在回收站恢复。',
        danger: true,
      }))
    )
      return
    // 回收站：先留快照（卡片 + 其标签关联），再走原流程
    pushTrash({
      kind: 'card',
      id: newTrashId(),
      deletedAt: nowIso(),
      title: card.title,
      cards: [card],
      relations: promptTags.filter((rt) => rt.prompt_id === id),
    })
    // P2-5：缓存删除前快照，10s 内可撤销回退
    const snapshotCards = cards
    const snapshotPromptTags = promptTags
    // P0-A 关联不悬空：删除卡片时一并清除其标签关联，避免服务端校验拒绝 / 标签计数虚高
    markCardsCloudDirty()
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
      markCardsCloudDirty()
      setCards(snapshotCards)
      setPromptTags(snapshotPromptTags)
    })
  }

  // ===== 标签实体 CRUD（ID 解耦，绝不删 Prompt）=====

  /**
   * 创建标签（管理区 + 编辑时「创建新标签」）。返回 {ok,error} 供 TagPanel 显示校验错误。
   * 支持路径创建（Bug #2 修复）：名称含「/」时按「父/子/孙」逐级建立层级，叶子为最终创建的目标标签，
   * 与 resolveTagIds 的路径解析保持一致；createdRootId 为路径根节点 id（供 TagPanel 自动展开显示层级）。
   */
  function handleCreateTag(
    name: string,
    parentId: string | null,
  ): { ok: boolean; error?: string; createdRootId?: string } {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: '标签名称不能为空' }
    if (trimmed.length > 50) return { ok: false, error: '标签名称不超过 50 字' }
    // 新建标签无 tagId，不存在成环可能；只需校验父级实体存在（assertNoCycle 用于移动/已有标签）
    if (parentId !== null && !tags.some((t) => t.id === parentId)) {
      return { ok: false, error: '父标签不存在' }
    }
    const path = trimmed.includes('/') ? trimmed.split('/').map((p) => p.trim()).filter(Boolean) : [trimmed]
    if (path.length === 0) return { ok: false, error: '标签名称不能为空' }
    if (path.some((p) => p.length > 50)) return { ok: false, error: '标签名称不超过 50 字' }

    const snapshot = captureTagSnapshot()
    let nextTags = tags
    let cur: string | null = parentId
    let rootId: string | undefined
    let created = 0
    for (const part of path) {
      const existing = nextTags.find((t) => t.parent_id === cur && t.name === part)
      if (existing) {
        if (rootId === undefined) rootId = existing.id
        cur = existing.id
        continue
      }
      const [updated, tag] = createTag(nextTags, part, cur)
      nextTags = updated
      created++
      if (rootId === undefined) rootId = tag.id
      cur = tag.id
    }
    if (created === 0) {
      return { ok: false, error: '同一父级下已存在同名标签' }
    }
    setTags(nextTags)
    notifyWithUndo(`已创建标签「${path.join('/')}」`, () => restoreTagSnapshot(snapshot))
    return { ok: true, createdRootId: rootId }
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

  /**
   * 本机已先行删除后的云端补删：直接 await deletePromptTag（复用其同 id 写锁，与并发的
   * savePromptTag 排成先建后删）。成功才清该 id 的 tombstone 并推进云端基线对应 id；
   * 失败保留 tombstone 并吐司，由 effect 删除段继续兜底重试，不回滚本机已删状态。
   * 顺序按层级从深到浅，避免父行先删被 FK 拒绝（子行先走，父行随后必能删掉）。
   */
  async function deleteTagsInCloud(ids: Iterable<string>, order: Tag[]) {
    if (!cloudMode) return
    const byId = new Map(order.map((tag) => [tag.id, tag]))
    const depthOf = (tagId: string) => {
      let depth = 0
      let cur = byId.get(tagId)?.parent_id ?? null
      const guard = new Set<string>([tagId])
      while (cur !== null && !guard.has(cur)) {
        guard.add(cur)
        depth += 1
        cur = byId.get(cur)?.parent_id ?? null
      }
      return depth
    }
    const targets = [...new Set(ids)].sort((a, b) => depthOf(b) - depthOf(a))
    let failureMessage: string | null = null
    for (const tagId of targets) {
      try {
        const result = await deletePromptTag(tagId)
        if (!result.ok) {
          failureMessage = result.message
          continue
        }
      } catch (error) {
        notify(`云端标签删除异常：${error instanceof Error ? error.message : String(error)}`)
        retryCloudSync()
        continue
      }
      cloudTagsRef.current?.delete(tagId)
      clearTagDeletes([tagId])
    }
    if (failureMessage !== null) {
      notify(`云端标签删除失败：${failureMessage}`)
      retryCloudSync()
    }
  }

  /** 删除标签（交接 §40）：级联删关系、删实体，绝不删 Prompt。
   *  @param mode self=仅删自身（子标签提升一级）/ subtree=删除整棵子树（交接 §12 模式 A/B） */
  async function handleDeleteTag(id: string, mode: 'self' | 'subtree' = 'self') {
    const tag = tags.find((t) => t.id === id)
    if (!tag) return
    const snapshot = captureTagSnapshot()
    // 回收站：先留快照（被删标签实体 + 被级联删掉的关联），子标签上提的不算删除不进站
    const removedIds = mode === 'subtree' ? new Set([id, ...collectDescendantIds(tags, id)]) : new Set([id])
    // 先落 tombstones：删除意图必须先于云端删除持久化，回填（快照/缓存/派生）时才拦得住复活。
    markTagsDeleted(removedIds)
    pushTrash({
      kind: 'tag',
      id: newTrashId(),
      deletedAt: nowIso(),
      title: mode === 'subtree' ? `${tagPath(tags, id)}（子树）` : tagPath(tags, id),
      tags: tags.filter((t) => removedIds.has(t.id)),
      relations: promptTags.filter((rt) => removedIds.has(rt.tag_id)),
    })
    const { tags: nextTags, promptTags: nextPromptTags } = deleteTag(tags, promptTags, id, mode === 'subtree')
    applyTags(nextTags, nextPromptTags)
    const removedFilterIds = removedIds
    setTagFilters((prev) => ({
      ...prev,
      any: prev.any.filter((filterId) => !removedFilterIds.has(filterId)),
      all: prev.all.filter((filterId) => !removedFilterIds.has(filterId)),
      none: prev.none.filter((filterId) => !removedFilterIds.has(filterId)),
    }))
    notifyWithUndo(`已删除标签「${tag.name}」（提示词未受影响）`, () => restoreTagSnapshot(snapshot))
    // 不再只靠 effect 差集：本机落盘后直接补云端删除（成功清 tombstone、失败留给 effect 兜底）。
    await deleteTagsInCloud(removedIds, tags)
  }

  /** 批量删除标签（MVP）：单快照 + 逐个 self 语义删除（子标签提升一级，绝不删 Prompt）。
   *  所选若含祖孙关系，只删最高层，跳过已被删祖先的子孙（依据操作前的层级判定）。 */
  async function handleBulkDeleteTags(ids: string[]) {
    const requested = [...new Set(ids)]
    if (requested.length === 0) return
    const snapshot = captureTagSnapshot()
    const byId = new Map(tags.map((t) => [t.id, t]))
    const removed = new Set<string>()
    let nextTags = tags
    let nextPromptTags = promptTags
    for (const id of requested) {
      const tag = byId.get(id)
      if (!tag) continue // 已不存在（并发删除等），跳过
      // 祖先已被本次删除时跳过该子孙（只删最高层）
      let cur = tag.parent_id
      const guard = new Set<string>()
      let ancestorRemoved = false
      while (cur !== null && !guard.has(cur)) {
        if (removed.has(cur)) {
          ancestorRemoved = true
          break
        }
        guard.add(cur)
        cur = byId.get(cur)?.parent_id ?? null
      }
      if (ancestorRemoved) continue
      const result = deleteTag(nextTags, nextPromptTags, id, false)
      nextTags = result.tags
      nextPromptTags = result.promptTags
      removed.add(id)
    }
    if (removed.size === 0) return
    markTagsDeleted(removed)
    // 回收站：与单删对齐，先留快照（被删标签实体 + 被级联删掉的关联），
    // 子标签按 self 语义上提一级、并未删除，不进站。
    const removedIds = [...removed]
    const removedTitle = tagPath(tags, removedIds[0])
    pushTrash({
      kind: 'tag',
      id: newTrashId(),
      deletedAt: nowIso(),
      title: removedIds.length === 1 ? removedTitle : `${removedTitle} 等 ${removedIds.length} 个`,
      tags: tags.filter((t) => removed.has(t.id)),
      relations: promptTags.filter((rt) => removed.has(rt.tag_id)),
    })
    applyTags(nextTags, nextPromptTags)
    setTagFilters((prev) => ({
      ...prev,
      any: prev.any.filter((filterId) => !removed.has(filterId)),
      all: prev.all.filter((filterId) => !removed.has(filterId)),
      none: prev.none.filter((filterId) => !removed.has(filterId)),
    }))
    notifyWithUndo(`已删除 ${removed.size} 个标签（提示词未受影响）`, () => restoreTagSnapshot(snapshot))
    await deleteTagsInCloud(removed, tags)
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
    markTagsDeleted([sourceId])
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

  /** 退出多选模式：清空选中并收起 SortBar 的多选提示区 */
  function exitBulkMode() {
    setBulkMode(false)
    setBulkIds(new Set())
  }

  /** 进入/退出多选模式（退出时一并清空选中） */
  function handleBulkModeChange(next: boolean) {
    if (next) setBulkMode(true)
    else exitBulkMode()
  }

  /** 全选当前视图（标签筛选 + 搜索 + 排序后）的卡片 */
  function selectAllVisibleCards() {
    setBulkIds(new Set(visibleCards.map((card) => card.id)))
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
  async function handleBulkDelete() {
    if (bulkIds.size === 0) return
    if (
      settings.confirmDelete &&
      !(await askConfirm({
        title: `确定删除选中的 ${bulkIds.size} 张卡片？`,
        description: '可在回收站恢复。',
        danger: true,
      }))
    ) {
      return
    }
    const snapshotCards = cards
    const snapshotPromptTags = promptTags
    const ids = bulkIds
    const count = ids.size
    pushTrash({
      kind: 'card',
      id: newTrashId(),
      deletedAt: nowIso(),
      title: `${cards.find((c) => ids.has(c.id))?.title ?? '卡片'}等 ${count} 张`,
      cards: cards.filter((c) => ids.has(c.id)),
      relations: promptTags.filter((rt) => ids.has(rt.prompt_id)),
    })
    markCardsCloudDirty()
    setCards((prev) => prev.filter((c) => !ids.has(c.id)))
    // P0-A 关联不悬空：批量删除卡片时一并清除其标签关联
    setPromptTags((prev) => prev.filter((rt) => !ids.has(rt.prompt_id)))
    if (selectedId && ids.has(selectedId)) setSelectedId(null)
    if (detailId && ids.has(detailId)) setDetailId(null)
    clearBulk()
    notifyWithUndo(`已删除 ${count} 张卡片`, () => {
      markCardsCloudDirty()
      setCards(snapshotCards)
      setPromptTags(snapshotPromptTags)
    })
  }

  // 批量打标签：追加去重（不覆盖卡片已有标签），走标签实体关系
  async function handleBulkTag() {
    if (bulkIds.size === 0) return
    const input = await askPrompt({
      title: `为选中的 ${bulkIds.size} 张卡片添加标签（多个用逗号/顿号分隔）`,
    })
    if (input === null) return
    const tagNames = parseTags(input)
    if (tagNames.length === 0) {
      notify('未输入有效标签')
      return
    }
    const { tagIds, nextTags, nextPromptTags: migratedPromptTags } = resolveTagIds(tagNames, promptTags)
    const ids = bulkIds
    // 基于当前 promptTags 计算实际变更数，再统一应用
    let changed = 0
    let nextPromptTags = migratedPromptTags
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
  async function handleBulkRemoveTag() {
    if (bulkIds.size === 0) return
    const input = await askPrompt({
      title: `从选中的 ${bulkIds.size} 张卡片中移除标签（多个用逗号/顿号分隔）`,
    })
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

  // 批量打星：0-5 整数，0 表示清零；非法输入在弹窗内拦截（不关弹窗、不清空已输入内容）
  async function handleBulkRate() {
    if (bulkIds.size === 0) return
    const input = await askPrompt({
      title: `为选中的 ${bulkIds.size} 张卡片设置评分（0-5 整数，0 表示清零）`,
      validate: (value) => {
        const parsed = Number(value)
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5 ? null : '评分需为 0-5 的整数'
      },
    })
    if (input === null) return
    const n = Number(input)
    const ids = bulkIds
    const count = ids.size
    markCardsCloudDirty()
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
    reader.onload = async () => {
      const result = parseImport(String(reader.result ?? ''))
      if (!result.ok) {
        notify(`导入失败：${result.error}`)
        return
      }
      if (
        !(await askConfirm({
          title: `导入将覆盖当前全部 ${cards.length} 张卡片，确定继续？`,
          danger: true,
        }))
      )
        return
      // P2-5：缓存覆盖前快照（卡片 + 设置 + 标签），10s 内可撤销回退
      const snapshotCards = cards
      const snapshotSettings = settings
      const snapshotTags = tags
      const snapshotPromptTags = promptTags
      markCardsCloudDirty()
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
      exitBulkMode()
      // P3-5 + P2-5 合并：导入结果带详情列表 + 10s 撤销
      {
        const skipped = result.skipped ?? []
        const undo = () => {
          markCardsCloudDirty()
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
      // 详情弹窗 / 设置弹窗 / 回收站打开时屏蔽全局评分快捷键，避免误触背景卡片评分
      if (detailId || showSettings || showTrash) return
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
  }, [view, detailCard, selectedId, cards, handleRate, detailId, showSettings, showTrash])

  // 多选模式：Esc 退出并清空选中（确认弹窗开启时由弹窗自己在捕获阶段拦下 Esc，不会误退）
  useEffect(() => {
    if (!bulkMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setBulkMode(false)
      setBulkIds(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bulkMode])

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
        onOpenTrash={() => setShowTrash(true)}
        trashCount={trash.length}
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
          syncMode={cloudMode ? 'cloud' : 'legacy'}
          onCreateTag={isDemoView ? undefined : handleCreateTag}
          onRenameTag={isDemoView ? undefined : handleRenameTag}
          onMoveTag={isDemoView ? undefined : handleMoveTag}
          onReorderTag={isDemoView ? undefined : handleReorderTag}
          onDeleteTag={isDemoView ? undefined : handleDeleteTag}
          onMergeTag={isDemoView ? undefined : handleMergeTag}
          onBulkDeleteTags={isDemoView ? undefined : handleBulkDeleteTags}
          confirmDelete={settings.confirmDelete}
        />
        <main className="flex min-w-0 flex-1 gap-4 overflow-hidden px-5 py-4">
          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto">
            {!isDemoView && hydrated && cloudMode && serverOnline === false && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rust/40 bg-rust/10 px-3.5 py-2.5">
                <span className="text-xs leading-relaxed text-rust">
                  云端暂时不可用：已保持在 Supabase 云端模式（登录态有效），正在自动重试；期间修改仅保存在本机缓存，不会写入局域网共享存储。
                </span>
                <button type="button" className="btn px-2.5 py-1 text-xs" onClick={() => void connect()}>
                  立即重试
                </button>
              </div>
            )}
            <SortBar
              mode={sortMode}
              onChange={setSortMode}
              count={visibleCards.length}
              total={baseCards.length}
              scopeLabel={tagFilterSummary || (isDemoView ? '示例知识库' : '全部')}
              search={searchQuery}
              onSearchChange={setSearchQuery}
              hasCodeOnly={hasCodeOnly}
              onHasCodeOnlyChange={setHasCodeOnly}
              tagFilterSummary={tagFilterSummary}
              onClearTagFilters={resetTagFilters}
              bulkMode={bulkMode}
              onBulkModeChange={isDemoView ? undefined : handleBulkModeChange}
              onBulkSelectAll={selectAllVisibleCards}
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
              <Composer
                existingTags={existingTags}
                addMode={settings.composerAddMode}
                autoFormatBody={settings.autoFormatBody}
                composerAutoTags={settings.composerAutoTags}
                composerAutoTitle={settings.composerAutoTitle}
                bodyAlignment={settings.bodyAlignment}
                onComposerOptionsChange={handleComposerOptionsChange}
                onCreate={handleCreate}
                onApplyGeneratedMeta={handleApplyGeneratedMeta}
                notify={notify}
              />
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
                      <span className="text-sm font-medium text-rust">{cloudMode ? '云端同步离线' : '同步服务离线'}</span>
                      <p className="max-w-xs text-xs leading-relaxed text-muted">
                        未连接到{cloudMode ? ' Supabase 云端' : '同步服务'}，当前显示本机缓存（共 {cards.length} 张本地卡片）。修改不会同步到其他设备。
                      </p>
                      <button type="button" className="btn px-3 py-1 text-xs" onClick={() => void connect()}>
                        重试连接
                      </button>
                    </div>
                  )}
                  {!isDemoView && serverOnline === null && (
                    <div className="w-full max-w-sm rounded-lg border border-line bg-ink-850 px-4 py-2 text-xs text-muted">
                      正在连接{cloudMode ? ' Supabase 云端' : '同步服务'}…
                    </div>
                  )}
                  {!isDemoView && serverOnline === true && (
                    <div className="w-full max-w-sm text-[11px] text-muted">{cloudMode ? '已连接 Supabase 云端同步' : '已连接同步服务'}</div>
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
                    tagLabels={cardTagLabels.get(card.id)}
                    selected={selectedId === card.id}
                    readonly={isDemoView}
                    onSelect={() => setSelectedId(card.id)}
                    onOpen={() => setDetailId(card.id)}
                    onCopy={() => handleCopy(card.id)}
                    onRate={(r) => handleRate(card.id, r)}
                    onDelete={isDemoView ? undefined : handleDeleteCard}
                    bulkSelected={bulkIds.has(card.id)}
                    bulkActive={bulkMode || bulkIds.size > 0}
                    onBulkToggle={isDemoView ? undefined : toggleBulk}
                    hoverPreview={settings.hoverPreview}
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
            tagLabels={previewCard ? cardTagLabels.get(previewCard.id) : undefined}
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
            onUpdateSourceUrl={handleUpdateSourceUrl}
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
          tagLabels={cardTagLabels.get(detailCard.id)}
          allCodes={allCodes}
          customThinkingPrompt={settings.thinkingSummaryPrompt}
          bodyAlignment={settings.bodyAlignment}
          onClose={() => setDetailId(null)}
          onSaveBody={handleSaveBody}
          onUpdateMeta={handleUpdateMeta}
          onUpdateCode={handleUpdateCode}
          onUpdateNotes={handleUpdateNotes}
          onUpdateSourceUrl={handleUpdateSourceUrl}
          onRate={handleRate}
          onCopy={handleCopy}
          onResetCopies={handleResetCopies}
          onRollback={handleRollback}
          onSetSummary={handleSetSummary}
          onDelete={handleDeleteCard}
          notify={notify}
        />
      )}
      {showTrash && (
        <TrashModal
          entries={trash}
          onRestore={handleRestoreTrash}
          onEmpty={handleEmptyTrash}
          onClose={() => setShowTrash(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
          onNotify={notify}
        />
      )}
      {confirmDialog}
      {promptDialog}
      <Toast
        message={toast?.msg ?? null}
        detail={toast?.detail ?? null}
        action={toast?.withUndo ? { label: '撤销', onClick: handleUndo } : null}
      />
    </div>
  )
}
