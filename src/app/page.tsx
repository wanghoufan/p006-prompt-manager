'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Card, Settings, SortMode } from '@/lib/types'
import { loadCards, loadSettings, parseImport, saveCards, saveSettings, buildMarkdownExport, isServerAvailable, loadFromServer, pushToServer, subscribeSync } from '@/lib/storage'
import { createCard, rollbackToVersion, saveBodyOnly, saveBodyWithVersion } from '@/lib/cards'
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
  const [settings, setSettings] = useState<Settings>(() => ({ thinkingSummaryPrompt: '' }))
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<ViewMode>('mine')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  // 全局搜索（范围 A）：searchQuery 为受控输入即时值，debouncedQuery 为 300ms 防抖后的过滤依据；
  // 搜索词不持久化（刷新即清，仅 useState）
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)

  const notify = useCallback((msg: string) => {
    setToast(msg)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 全局搜索 300ms 防抖（纯前端过滤，无依赖）
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const isDemoView = view === 'demo'
  const sourceCards = isDemoView ? DEMO_CARDS : cards

  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const serverOk = await isServerAvailable()
      if (!serverOk) {
        // 离线兜底：使用本机 localStorage 数据
        if (cancelled) return
        setServerOnline(false)
        setCards(loadCards())
        setSettings(loadSettings())
        setHydrated(true)
        notify('未连接同步服务，已使用本机本地数据（不同步）')
        return
      }
      const remote = await loadFromServer()
      if (cancelled) return
      if (!remote) {
        setServerOnline(false)
        return
      }
      setServerOnline(true)
      // 服务端为空但本机有数据：首次迁移上传，避免两边永远为空
      if (remote.cards.length === 0) {
        const local = loadCards()
        if (local.length > 0) {
          await pushToServer(local, loadSettings())
          setCards(local)
          setSettings(loadSettings())
        }
      } else {
        setCards(remote.cards)
        setSettings(remote.settings)
      }
      // 订阅实时同步：另一台电脑改动时自动拉取最新数据
      unsub = subscribeSync((rc, rs) => {
        if (cancelled) return
        setCards(rc)
        setSettings(rs)
      })
      setHydrated(true)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (unsub) unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  useEffect(() => {
    if (hydrated) saveSettings(settings)
  }, [settings, hydrated])

  const updateCard = useCallback((id: string, patch: (c: Card) => Card) => {
    setCards((prev) => prev.map((c) => (c.id === id ? patch(c) : c)))
  }, [])

  const handleRate = useCallback((id: string, rating: number) => {
    updateCard(id, (c) => ({ ...c, rating }))
  }, [updateCard])

  const tagEntries = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of sourceCards) {
      for (const t of c.tags) map.set(t, (map.get(t) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
  }, [sourceCards])

  const existingTags = useMemo(() => tagEntries.map(([t]) => t), [tagEntries])

  const allCodes = useMemo(
    () => cards.map((c) => c.code).filter((c): c is string => Boolean(c)),
    [cards],
  )

  // 过滤链三段：baseCards（视图 + 标签）→ 搜索过滤（AND 叠加）→ 排序
  const baseCards = useMemo(() => {
    return selectedTag ? sourceCards.filter((c) => c.tags.includes(selectedTag)) : sourceCards
  }, [sourceCards, selectedTag])

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

  function handleCreate(body: string, title: string, tags: string[]) {
    setCards((prev) => [createCard(body, title, tags), ...prev])
  }

  function handleLoadDemo() {
    if (cards.length > 0 && !window.confirm(`载入示例将【替换】当前 ${cards.length} 张卡片（非追加），确定继续？`)) {
      return
    }
    setCards(DEMO_CARDS.map((c) => ({ ...c })))
    setView('mine')
    setSelectedTag(null)
    setSelectedId(null)
    setDetailId(null)
    notify(`已载入 ${DEMO_CARDS.length} 张示例卡片`)
  }

  function handleClearRepo() {
    if (cards.length === 0) {
      notify('仓库已经是空的')
      return
    }
    if (!window.confirm(`确定清空我的仓库（共 ${cards.length} 张卡片）？此操作不可撤销。`)) {
      return
    }
    setCards([])
    setSelectedTag(null)
    setSelectedId(null)
    setDetailId(null)
    notify('仓库已清空')
  }

  function handleSwitchView(next: ViewMode) {
    setView(next)
    setSelectedTag(null)
    setSelectedId(null)
    setDetailId(null)
  }

  function handleSelectTag(tag: string | null) {
    setSelectedTag(tag)
    setSelectedId(null)
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

  function handleUpdateMeta(id: string, title: string, tags: string[]) {
    updateCard(id, (c) => ({ ...c, title, tags, updatedAt: nowIso() }))
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

  function handleDeleteCard(id: string) {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    if (!window.confirm(`确定删除「${card.title}」？此操作不可撤销。`)) return
    setCards((prev) => prev.filter((c) => c.id !== id))
    setDetailId(null)
    if (selectedId === id) setSelectedId(null)
    notify('卡片已删除')
  }

  // P2-9 删除标签 = 批量从卡片移除该标签条目（不删卡片，语义与 Flomo 一致）
  function handleDeleteTag(tag: string) {
    const count = cards.filter((c) => c.tags.includes(tag)).length
    if (count === 0) return
    if (!window.confirm(`将从 ${count} 张卡片中移除标签「${tag}」，卡片本身不会删除，确定继续？`)) return
    setCards((prev) =>
      prev.map((c) => (c.tags.includes(tag) ? { ...c, tags: c.tags.filter((t) => t !== tag) } : c)),
    )
    if (selectedTag === tag) setSelectedTag(null)
    notify(`已从 ${count} 张卡片移除标签「${tag}」`)
  }

  function handleExport() {
    const md = buildMarkdownExport(cards)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `提示词库备份-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
      setCards(result.cards)
      if (result.settings) setSettings(result.settings)
      setView('mine')
      setSelectedTag(null)
      setSelectedId(null)
      setDetailId(null)
      notify(`导入成功：${result.cards.length} 张卡片`)
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
          entries={tagEntries}
          total={sourceCards.length}
          selected={selectedTag}
          onSelect={handleSelectTag}
          offline={serverOnline === false}
          onDeleteTag={isDemoView ? undefined : handleDeleteTag}
        />
        <main className="flex min-w-0 flex-1 gap-4 overflow-hidden px-5 py-4">
          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto">
            <SortBar
              mode={sortMode}
              onChange={setSortMode}
              count={visibleCards.length}
              total={baseCards.length}
              scopeLabel={selectedTag ?? (isDemoView ? '示例知识库' : '全部')}
              search={searchQuery}
              onSearchChange={setSearchQuery}
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
      <Toast message={toast} />
    </div>
  )
}