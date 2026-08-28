'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Version } from '@/lib/types'
import { cardDraftChanges, cardDraftFrom, normalizeBody, normalizeCode, parseTags } from '@/lib/cards'
import type { CardDraft } from '@/lib/cards'
import { Stars } from '@/components/Stars'
import { Spinner } from '@/components/Spinner'
import { TagEditor } from '@/components/TagEditor'
import { VersionDiff } from '@/components/VersionDiff'
import { formatTime } from '@/lib/util'

interface PreviewPanelProps {
  card: Card | null
  readonly?: boolean
  existingTags: string[]
  /** 全部卡片的调取码（不含当前卡片），用于冲突检测 */
  allCodes: string[]
  customThinkingPrompt: string
  autoFormatBody: boolean
  bodyAlignment: 'left' | 'center' | 'right'
  defaultWidth?: number
  onCopy: () => void
  onRate: (rating: number) => void
  onSaveBody: (id: string, body: string, createVersion: boolean) => void
  onUpdateMeta: (id: string, title: string, tags: string[]) => void
  onUpdateCode: (id: string, code: string | null) => void
  onUpdateNotes: (id: string, notes: string) => void
  onResetCopies: (id: string) => void
  onRollback: (id: string, versionId: string) => void
  onSetSummary: (id: string, summary: string) => void
  onDelete?: (id: string) => void
  /** P2-3 移动端底部抽屉：收起抽屉时回调（桌面侧边栏不渲染该按钮） */
  onClose?: () => void
  notify: (msg: string) => void
}

const WIDTH_KEY = 'pm:preview-width'
const MIN_W = 320
const MAX_W = 720

function clampWidth(w: number): number {
  return Math.min(MAX_W, Math.max(MIN_W, Math.round(w)))
}

function readSavedWidth(defaultWidth: number): number {
  if (typeof window === 'undefined') return defaultWidth
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    if (Number.isFinite(saved) && saved >= MIN_W && saved <= MAX_W) return saved
  } catch {
    // ignore
  }
  return defaultWidth
}

export function PreviewPanel({
  card,
  readonly = false,
  existingTags,
  allCodes,
  customThinkingPrompt,
  autoFormatBody,
  bodyAlignment,
  defaultWidth = 320,
  onCopy,
  onRate,
  onSaveBody,
  onUpdateMeta,
  onUpdateCode,
  onUpdateNotes,
  onResetCopies,
  onRollback,
  onSetSummary,
  onDelete,
  onClose,
  notify,
}: PreviewPanelProps) {
  const [draft, setDraft] = useState<CardDraft>(() =>
    card ? cardDraftFrom(card) : { title: '', tagsText: '', body: '', rating: 0, code: '', notes: '' },
  )
  const draftRef = useRef(draft)
  const cardRef = useRef(card)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(() => {
    cardRef.current = card
  }, [card])
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const notesTimer = useRef<number | null>(null)
  // 正文脏标记：正文修改后置 true；失焦自动保存不清除，手动保存建版后清除。
  // 用于解决「点击保存按钮时 textarea 先 blur 自动保存正文，导致手动保存无 body 变更而不建版」的问题。
  const bodyDirtyRef = useRef(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [formatLoading, setFormatLoading] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  // P3-2：当前展开完整内容/diff 的版本 id（单开，再点收起）
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [width, setWidth] = useState<number>(() => readSavedWidth(defaultWidth))
  const dragState = useRef<{ startX: number; startW: number } | null>(null)
  // <md 时作为底部抽屉：先从屏幕底部进入，拖动手柄下拉可收起。
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const mobileDragStartY = useRef<number | null>(null)
  const mobileCloseTimer = useRef<number | null>(null)
  const firstSync = useRef(true)
  // RISK-3：AI 请求取消控制器（新请求前 abort 上一个，卸载时 abort）
  const metaAbortRef = useRef<AbortController | null>(null)
  const summaryAbortRef = useRef<AbortController | null>(null)
  const formatAbortRef = useRef<AbortController | null>(null)
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)
  // P3-1：调取码非法字符被自动过滤后的即时提示（2.5s 自动消失）
  const [codeFiltered, setCodeFiltered] = useState(false)
  const codeTipTimer = useRef<number | null>(null)

  // 调取码冲突检测：与其他卡片的 code 相同（排除自己）视为冲突
  const codeConflict = useMemo(() => {
    if (!card) return false
    const c = normalizeCode(draft.code)
    if (!c) return false
    return allCodes.includes(c) && card.code !== c
  }, [draft.code, allCodes, card])

  function handleDragStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startW: width }
    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', handleDragEnd)
  }

  function handleDragMove(e: PointerEvent) {
    if (!dragState.current) return
    const { startX, startW } = dragState.current
    const next = clampWidth(startW + (startX - e.clientX))
    setWidth(next)
    try {
      localStorage.setItem(WIDTH_KEY, String(next))
    } catch {
      // ignore
    }
  }

  function handleDragEnd() {
    dragState.current = null
    window.removeEventListener('pointermove', handleDragMove)
    window.removeEventListener('pointerup', handleDragEnd)
  }

  function handleMobileHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    mobileDragStartY.current = e.clientY
    window.addEventListener('pointerup', handleMobileHandlePointerUp, { once: true })
  }

  function handleMobileHandlePointerUp(e: PointerEvent) {
    const startY = mobileDragStartY.current
    mobileDragStartY.current = null
    // 下拉至少 56px 才收起，避免手柄的普通点按误关闭。
    if (startY !== null && e.clientY - startY >= 56) handleClose()
  }

  function resetWidth() {
    setWidth(defaultWidth)
    try {
      localStorage.setItem(WIDTH_KEY, String(defaultWidth))
    } catch {
      // ignore
    }
    notify('宽度已重置')
  }

  useEffect(() => {
    if (!card) return
    if (firstSync.current) {
      firstSync.current = false
      return
    }
    // P2-4：外部数据更新（SSE / 回滚 / 保存回写）覆盖草稿前，先清理备注定时器并 flush 未落库修改，
    // 避免多设备同步或回滚时把正在输入的备注直接覆盖丢失
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    commitSave(true)
    const timer = window.setTimeout(() => setDraft(cardDraftFrom(card)), 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card])

  useEffect(() => {
    if (!card) return
    const frame = window.requestAnimationFrame(() => setMobileDrawerOpen(true))
    return () => window.cancelAnimationFrame(frame)
  }, [card])

  // silent=true 用于失焦/防抖自动保存：静默落地，不弹 toast，仅更新「已自动保存」角标
  // flushOnly=true 用于卸载前兜底：只调用保存回调，不 setState、不弹 toast
  function saveThrough(silent: boolean, flushOnly: boolean) {
    const c = cardRef.current
    if (!c) return
    const d = draftRef.current
    const changes = cardDraftChanges(d, c)
    const nonCodeChanged =
      changes.bodyChanged ||
      changes.titleChanged ||
      changes.tagsChanged ||
      changes.notesChanged ||
      changes.ratingChanged
    const code = normalizeCode(d.code)
    const conflict = code !== '' && allCodes.includes(code) && c.code !== code
    // 手动保存补建版：正文刚被失焦自动保存过（anyChanged 已为 false），
    // 但用户主动点「保存」，仍应为当前正文生成版本快照
    const needManualVersion = !silent && !flushOnly && bodyDirtyRef.current && !changes.bodyChanged && d.body === c.body
    if (!changes.anyChanged && !needManualVersion) {
      if (!silent && !flushOnly) notify('没有需要保存的修改')
      return
    }
    // 失焦自动保存仅存正文不建版；版本仅由手动保存 / Ctrl(⌘)+Enter 触发
    if (changes.bodyChanged) {
      onSaveBody(c.id, d.body, !silent)
      if (!silent) bodyDirtyRef.current = false
    } else if (needManualVersion) {
      onSaveBody(c.id, d.body, true)
      bodyDirtyRef.current = false
    }
    if (changes.titleChanged || changes.tagsChanged) {
      onUpdateMeta(c.id, d.title.trim() || c.title, parseTags(d.tagsText))
    }
    // 调取码冲突时跳过该字段，其余字段照常保存
    if (changes.codeChanged && !conflict) onUpdateCode(c.id, code || null)
    if (changes.notesChanged) onUpdateNotes(c.id, d.notes)
    if (changes.ratingChanged) onRate(d.rating)
    if (flushOnly) return
    setSavedAt(Date.now())
    // 静默保存遇冲突也要给出可见提示（code 字段被跳过，其余字段已保存）
    if (conflict && changes.codeChanged) {
      notify('调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试')
    } else if (!silent) {
      notify(conflict && !nonCodeChanged ? '调取码与其他卡片冲突，请更换后再保存' : '已保存')
    }
  }

  function commitSave(silent: boolean) {
    saveThrough(silent, false)
  }

  // 卸载前兜底：切换选中卡片 / 组件卸载时 flush 未保存草稿、清理定时器并 abort 未完成 AI 请求
  useEffect(() => {
    return () => {
      if (notesTimer.current) window.clearTimeout(notesTimer.current)
      if (codeTipTimer.current) window.clearTimeout(codeTipTimer.current)
      metaAbortRef.current?.abort()
      summaryAbortRef.current?.abort()
      formatAbortRef.current?.abort()
      if (mobileCloseTimer.current) window.clearTimeout(mobileCloseTimer.current)
      saveThrough(true, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSave() {
    commitSave(false)
  }

  // P1-2：收起移动端抽屉前 flush 未保存草稿，避免「光标仍在输入框」直接收起导致修改丢失
  function handleClose() {
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    commitSave(true)
    setMobileDrawerOpen(false)
    if (mobileCloseTimer.current) window.clearTimeout(mobileCloseTimer.current)
    // 等抽屉滑回底部后，再清除选中项；桌面端不显示此入口，原行为不受影响。
    mobileCloseTimer.current = window.setTimeout(() => onClose?.(), 200)
  }

  // 备注边输入边存：停手 700ms 后自动落库
  function scheduleNotesSave() {
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    notesTimer.current = window.setTimeout(() => commitSave(true), 700)
  }

  // P3-1：调取码输入即时过滤非法字符（仅英文/数字/短横线），并短暂提示
  function handleCodeInput(v: string) {
    const filtered = v.replace(/[^a-zA-Z0-9-]/g, '')
    setDraft((d) => ({ ...d, code: filtered }))
    if (filtered !== v) {
      setCodeFiltered(true)
      if (codeTipTimer.current) window.clearTimeout(codeTipTimer.current)
      codeTipTimer.current = window.setTimeout(() => setCodeFiltered(false), 2500)
    }
  }

  async function regenMeta() {
    if (!card) return
    metaAbortRef.current?.abort()
    const ac = new AbortController()
    metaAbortRef.current = ac
    setMetaLoading(true)
    try {
      const res = await fetch('/api/ai/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, existingTags }),
        signal: ac.signal,
      })
      const data: { title?: string; tags?: string[]; error?: string } = await res.json()
      if (ac.signal.aborted) return
      if (!res.ok) throw new Error(data.error || '重新生成失败')
      const newTitle = data.title?.trim() || card.title
      const newTags = data.tags ?? []
      onUpdateMeta(card.id, newTitle, newTags)
      setDraft((d) => ({ ...d, title: newTitle, tagsText: newTags.join('、') }))
      notify('已重新生成标签与标题')
    } catch (e) {
      if (ac.signal.aborted) return
      notify(`重新生成失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      if (!ac.signal.aborted && metaAbortRef.current === ac) setMetaLoading(false)
    }
  }

  async function runSummary() {
    if (!card) return
    summaryAbortRef.current?.abort()
    const ac = new AbortController()
    summaryAbortRef.current = ac
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/ai/summarize-thinking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, prompt: customThinkingPrompt || null }),
        signal: ac.signal,
      })
      const data: { summary?: string; error?: string } = await res.json()
      if (ac.signal.aborted) return
      if (!res.ok) throw new Error(data.error || '总结失败')
      onSetSummary(card.id, data.summary ?? '')
      notify('思维总结已生成')
    } catch (e) {
      if (ac.signal.aborted) return
      notify(`总结失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      if (!ac.signal.aborted && summaryAbortRef.current === ac) setSummaryLoading(false)
    }
  }

  /** P0-I：AI 整理后立即落库；自动整理不建版本，手动整理保留一条可回滚快照。 */
  async function runBodyFormat(source: string, automatic: boolean) {
    const c = cardRef.current
    if (!c) return
    if (!source.trim()) {
      if (!automatic) notify('正文为空，无法整理')
      return
    }
    formatAbortRef.current?.abort()
    const ac = new AbortController()
    formatAbortRef.current = ac
    setFormatLoading(true)
    try {
      const res = await fetch('/api/ai/format-body', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: source, alignment: bodyAlignment }),
        signal: ac.signal,
      })
      const data: { body?: string; error?: string } = await res.json()
      if (ac.signal.aborted) return
      if (!res.ok) throw new Error(data.error || '格式整理失败')
      // 自动整理期间用户继续编辑时，不能以旧响应覆盖新输入。
      if (bodyTextareaRef.current?.value !== source) return
      const formatted = typeof data.body === 'string' ? normalizeBody(data.body) : ''
      if (!formatted) throw new Error('AI 未返回可用正文')
      setDraft((d) => ({ ...d, body: formatted }))
      draftRef.current = { ...draftRef.current, body: formatted }
      bodyDirtyRef.current = false
      onSaveBody(c.id, formatted, !automatic)
      setSavedAt(Date.now())
      notify(automatic ? '已自动整理粘贴内容' : '正文格式已整理并保存')
    } catch (e) {
      if (ac.signal.aborted) return
      notify(`${automatic ? '自动整理' : '格式整理'}失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      if (!ac.signal.aborted && formatAbortRef.current === ac) setFormatLoading(false)
    }
  }

  function handleRollback(version: Version) {
    if (!card) return
    onRollback(card.id, version.id)
    notify('已回滚到该版本')
  }

  return (
    <aside
      // P2-3：<md 降为底部抽屉（仅选中卡片时出现，fixed 全宽 + 收起按钮）；
      // md+ 保持右侧可拖宽侧边栏（宽度由 --pw CSS 变量驱动，移动端忽略）
      className={`${
        card ? 'flex' : 'hidden md:flex'
      } fixed inset-x-0 bottom-0 z-30 max-h-[75dvh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-ink-900 transition-transform duration-200 ease-out ${
        mobileDrawerOpen ? 'translate-y-0' : 'translate-y-full'
      } md:relative md:inset-auto md:bottom-auto md:z-auto md:max-h-none md:w-[var(--pw)] md:shrink-0 md:translate-y-0 md:rounded-xl`}
      style={{ '--pw': `${width}px` } as React.CSSProperties}
    >
      <div
        onPointerDown={handleDragStart}
        onDoubleClick={resetWidth}
        role="separator"
        aria-orientation="vertical"
        title="拖动调整宽度 · 双击重置"
        className="absolute left-0 top-0 z-10 hidden h-full w-2 cursor-ew-resize bg-transparent transition-colors hover:bg-gold/10 active:bg-gold/20 md:block"
      />
      {card && onClose && (
        <div className="border-b border-line px-3 pb-1.5 pt-1 md:hidden">
          <div
            aria-hidden="true"
            className="mx-auto mb-1 h-1 w-9 touch-none rounded-full bg-muted/60"
            onPointerDown={handleMobileHandlePointerDown}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-paper">{card.title}</span>
            <button type="button" className="btn-ghost shrink-0 text-[10px]" onClick={handleClose}>
              关闭
            </button>
          </div>
        </div>
      )}
      {!card ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-2xl">⚡</span>
          <p className="text-xs leading-relaxed text-muted">
            点击左侧卡片，在此预览与编辑提示词
          </p>
          <p className="text-[10px] leading-relaxed text-muted/70">
            双击卡片进入详情 · 拖动左缘调宽，双击重置 · 选中后 1-5 打星
          </p>
        </div>
      ) : readonly ? (
        <>
          <header className="flex items-start justify-between gap-2 border-b border-line px-3 py-2">
            <h3 className="min-w-0 flex-1 font-serif text-sm text-paper" title={card.title}>
              {card.title}
            </h3>
            <span className="shrink-0 rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-bright">
              示例 · 只读
            </span>
          </header>
          <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-1.5">
            {card.tags.length > 0 ? (
              card.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-gold/25 bg-gold/5 px-2 py-0.5 text-[11px] text-gold-bright"
                >
                  {t}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-muted">未打标签</span>
            )}
          </div>
          {card.notes && (
            <div className="border-b border-line px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted">备注</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-paper-dim">
                {card.notes}
              </p>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-3 py-2 font-mono text-[15px] leading-relaxed text-paper-dim">
            {card.body}
          </div>
          <div className="flex border-t border-line text-[11px]">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 py-1.5 text-muted transition-colors hover:text-paper"
              onClick={() => setShowSummary((s) => !s)}
            >
              思维总结
              {card.thinkingSummary && (
                <span className="rounded-full border border-gold/25 bg-gold/5 px-1 text-[9px] text-gold-bright">已生成</span>
              )}
              <span className={`text-[10px] transition-transform ${showSummary ? 'rotate-90' : ''}`}>▸</span>
            </button>
            <div className="w-px bg-line" />
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 py-1.5 text-muted transition-colors hover:text-paper"
              onClick={() => setShowVersions((s) => !s)}
            >
              版本 {card.versions.length}
              <span className={`text-[10px] transition-transform ${showVersions ? 'rotate-90' : ''}`}>▸</span>
            </button>
          </div>
          {showSummary && (
            <p className="max-h-44 overflow-y-auto whitespace-pre-wrap border-t border-line px-3 py-2 text-xs leading-relaxed text-paper-dim">
              {card.thinkingSummary ?? '该示例卡片未生成思维总结。'}
            </p>
          )}
          {showVersions &&
            (card.versions.length === 0 ? (
              <p className="border-t border-line px-3 py-2 text-xs leading-relaxed text-muted">该示例卡片暂无版本记录。</p>
            ) : (
              <ul className="max-h-44 space-y-1.5 overflow-y-auto border-t border-line px-3 py-2">
                {[...card.versions].reverse().map((v) => {
                  const expanded = expandedVersionId === v.id
                  return (
                    <li key={v.id} className="rounded-md border border-line bg-ink-850 px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-[10px] text-muted">{formatTime(v.createdAt)}</span>
                        <span
                          className="min-w-0 flex-1 cursor-pointer truncate text-[11px] text-paper-dim"
                          title="点击查看完整内容 / diff"
                          onClick={() => setExpandedVersionId(expanded ? null : v.id)}
                        >
                          {v.body}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost shrink-0 text-[10px]"
                          onClick={() => setExpandedVersionId(expanded ? null : v.id)}
                        >
                          {expanded ? '收起' : '查看完整内容'}
                        </button>
                      </div>
                      {expanded && (
                        <VersionDiff body={v.body} currentBody={card.body} className="mt-1.5 border-t border-line pt-1.5" />
                      )}
                    </li>
                  )
                })}
              </ul>
            ))}
          <footer className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Stars rating={card.rating} />
              <span className="font-mono text-xs text-muted">
                {card.copyCount} <span className="text-[10px]">次复制</span>
              </span>
            </div>
          </footer>
        </>
      ) : (
        <>
          <header className="border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="preview-title"
                  className="field w-full border-transparent bg-transparent px-0 py-0.5 pr-8 font-serif text-xl font-semibold text-paper focus:border-transparent"
                  value={draft.title}
                  maxLength={20}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  onBlur={() => commitSave(true)}
                  placeholder="一句话总结"
                />
                <span className="pointer-events-none absolute bottom-0 right-0 font-mono text-[9px] text-muted">
                  {draft.title.length}/20
                </span>
              </div>
              <div className="flex w-28 shrink-0 items-center gap-1">
                <span className="font-mono text-xs text-gold-bright">@</span>
                <input
                  id="preview-code"
                  className={`field min-w-0 flex-1 px-1.5 py-1 font-mono text-[11px] ${codeConflict ? 'border-rust/60 focus:border-rust' : ''}`}
                  value={draft.code}
                  maxLength={12}
                  onChange={(e) => handleCodeInput(e.target.value)}
                  onBlur={() => commitSave(true)}
                  placeholder="调取码"
                  aria-label="调取码"
                />
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0 text-[10px]"
                onClick={() => void regenMeta()}
                disabled={metaLoading}
              >
                {metaLoading ? '生成中…' : '⟳ 生成'}
              </button>
            </div>
            {codeConflict && (
              <p className="pt-1 text-[10px] text-rust">该调取码已被其他卡片使用，请更换</p>
            )}
            {codeFiltered && (
              <p className="pt-1 text-[10px] text-rust">仅支持英文/数字/短横线，已自动过滤</p>
            )}
            <textarea
              id="preview-notes"
              rows={2}
              placeholder="备注（自填 · 何时用/注意事项，失焦自动保存）"
              className="field mt-2 resize-y text-[12px] leading-relaxed"
              value={draft.notes}
              onChange={(e) => {
                setDraft((d) => ({ ...d, notes: e.target.value }))
                scheduleNotesSave()
              }}
              onBlur={() => {
                // P2-4：失焦即存时清掉待触发的防抖定时器，避免 700ms 后重复提交
                if (notesTimer.current) window.clearTimeout(notesTimer.current)
                commitSave(true)
              }}
            />
            <div className="mt-2">
              <TagEditor
                value={draft.tagsText}
                existingTags={existingTags}
                inputId="preview-tags"
                onChange={(nextTags) => {
                  setDraft((d) => ({ ...d, tagsText: nextTags.join('、') }))
                  onUpdateMeta(card.id, draftRef.current.title.trim() || card.title, nextTags)
                }}
              />
            </div>
          </header>
          <div className="flex min-h-0 flex-[3] flex-col border-t border-line px-4 py-3">
            <textarea
              id="preview-body"
              ref={bodyTextareaRef}
              className="field mt-0 min-h-0 flex-1 resize-none font-mono text-[15px] leading-relaxed"
              style={{ textAlign: bodyAlignment }}
              value={draft.body}
              onChange={(e) => {
                setDraft((d) => ({ ...d, body: e.target.value }))
                bodyDirtyRef.current = true
              }}
              onBlur={() => commitSave(true)}
              onPaste={(e) => {
                if (!autoFormatBody) return
                const textarea = e.currentTarget
                window.requestAnimationFrame(() => void runBodyFormat(textarea.value, true))
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>
          <div className="flex border-t border-line text-[11px]">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 py-1.5 text-muted transition-colors hover:text-paper"
              onClick={() => setShowSummary((s) => !s)}
            >
              思维总结
              {card.thinkingSummary && (
                <span className="rounded-full border border-gold/25 bg-gold/5 px-1 text-[9px] text-gold-bright">已生成</span>
              )}
              <span className={`text-[10px] transition-transform ${showSummary ? 'rotate-90' : ''}`}>▸</span>
            </button>
            <div className="w-px bg-line" />
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 py-1.5 text-muted transition-colors hover:text-paper"
              onClick={() => setShowVersions((s) => !s)}
            >
              版本 {card.versions.length}
              <span className={`text-[10px] transition-transform ${showVersions ? 'rotate-90' : ''}`}>▸</span>
            </button>
            <div className="w-px bg-line" />
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 py-1.5 text-muted transition-colors hover:text-paper disabled:cursor-wait disabled:opacity-60"
              onClick={() => void runBodyFormat(draftRef.current.body, false)}
              disabled={formatLoading}
              title={`按设置的${bodyAlignment === 'left' ? '左对齐' : bodyAlignment === 'center' ? '居中' : '右对齐'}整理正文`}
            >
              {formatLoading ? '整理中…' : '✦ 格式整理'}
            </button>
          </div>
          {showSummary && (
            <div className="border-t border-line px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted">AI 分析这条提示词的思维方式并缓存结果</span>
                <button
                  type="button"
                  className="btn-gold px-2 py-0.5 text-[10px]"
                  onClick={() => void runSummary()}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <Spinner className="h-2.5 w-2.5" />
                      总结中…
                    </span>
                  ) : card.thinkingSummary ? (
                    '重新生成'
                  ) : (
                    '生成总结'
                  )}
                </button>
              </div>
              <p className="mt-1.5 max-h-44 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-paper-dim">
                {card.thinkingSummary ?? '尚未生成。'}
              </p>
            </div>
          )}
          {showVersions &&
            (card.versions.length === 0 ? (
              <p className="border-t border-line px-3 py-2 text-xs leading-relaxed text-muted">
                暂无版本记录。修改正文后点「保存」或 Ctrl/⌘+Enter 会生成快照。
              </p>
            ) : (
              <ul className="max-h-44 space-y-1.5 overflow-y-auto border-t border-line px-3 py-2">
                {[...card.versions].reverse().map((v) => {
                  const expanded = expandedVersionId === v.id
                  return (
                    <li
                      key={v.id}
                      className="rounded-md border border-line bg-ink-850 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-[10px] text-muted">{formatTime(v.createdAt)}</span>
                        <span
                          className="min-w-0 flex-1 cursor-pointer truncate text-[11px] text-paper-dim"
                          title="点击查看完整内容 / diff"
                          onClick={() => setExpandedVersionId(expanded ? null : v.id)}
                        >
                          {v.body}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost shrink-0 text-[10px]"
                          onClick={() => setExpandedVersionId(expanded ? null : v.id)}
                        >
                          {expanded ? '收起' : '查看完整内容'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost shrink-0 text-[10px]"
                          onClick={() => handleRollback(v)}
                        >
                          回滚
                        </button>
                      </div>
                      {expanded && (
                        <VersionDiff body={v.body} currentBody={card.body} className="mt-1.5 border-t border-line pt-1.5" />
                      )}
                    </li>
                  )
                })}
              </ul>
            ))}
          <footer className="flex items-center justify-between gap-2 border-t border-line px-3 py-1">
            <div className="flex min-w-0 items-center gap-2">
              <Stars
                rating={draft.rating}
                onChange={(r) => {
                  setDraft((d) => ({ ...d, rating: r }))
                  onRate(r)
                }}
              />
              <span className="font-mono text-[11px] text-muted">{card.copyCount} 次</span>
              {savedAt && <span className="text-[10px] text-muted">· 已自动保存</span>}
              {onDelete && (
                <button
                  type="button"
                  className="btn-ghost shrink-0 text-[10px] text-rust hover:bg-rust/10"
                  onClick={() => onDelete(card.id)}
                >
                  删除
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn px-2 py-1 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy()
                }}
              >
                复制
              </button>
              <button
                type="button"
                className="btn px-2 py-1 text-[10px]"
                onClick={() => {
                  onResetCopies(card.id)
                  notify('复制次数已清零')
                }}
              >
                清零
              </button>
              <button type="button" className="btn-gold px-2.5 py-1 text-[10px]" onClick={handleSave}>
                保存
              </button>
            </div>
          </footer>
        </>
      )}
    </aside>
  )
}
