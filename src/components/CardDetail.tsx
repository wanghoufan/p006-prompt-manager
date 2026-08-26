'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Version } from '@/lib/types'
import { cardDraftChanges, cardDraftFrom, normalizeCode, parseTags } from '@/lib/cards'
import { Stars } from '@/components/Stars'
import { Spinner } from '@/components/Spinner'
import { VersionDiff } from '@/components/VersionDiff'
import { formatTime } from '@/lib/util'
import { useModalFocus } from '@/hooks/useModalFocus'

interface CardDetailProps {
  card: Card
  readonly?: boolean
  existingTags: string[]
  allCodes: string[]
  customThinkingPrompt: string
  onClose: () => void
  onSaveBody: (id: string, body: string, createVersion: boolean) => void
  onUpdateMeta: (id: string, title: string, tags: string[]) => void
  onUpdateCode: (id: string, code: string | null) => void
  onUpdateNotes: (id: string, notes: string) => void
  onRate: (id: string, rating: number) => void
  onCopy: (id: string) => void
  onResetCopies: (id: string) => void
  onRollback: (id: string, versionId: string) => void
  onSetSummary: (id: string, summary: string) => void
  onDelete?: (id: string) => void
  notify: (msg: string) => void
}

export function CardDetail(props: CardDetailProps) {
  const { card, readonly = false } = props
  const [draft, setDraft] = useState(cardDraftFrom(card))
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
  const [metaLoading, setMetaLoading] = useState(false)
  // P3-2：当前展开完整内容/diff 的版本 id（单开，再点收起）
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const firstSync = useRef(true)
  // RISK-3：AI 请求取消控制器（新请求前 abort 上一个，卸载时 abort）
  const metaAbortRef = useRef<AbortController | null>(null)
  const summaryAbortRef = useRef<AbortController | null>(null)
  // P3-1：调取码非法字符被自动过滤后的即时提示（2.5s 自动消失）
  const [codeFiltered, setCodeFiltered] = useState(false)
  const codeTipTimer = useRef<number | null>(null)
  useModalFocus(panelRef, true)

  const codeConflict = useMemo(() => {
    const c = normalizeCode(draft.code)
    if (!c) return false
    return props.allCodes.includes(c) && card.code !== c
  }, [draft.code, props.allCodes, card.code])

  useEffect(() => {
    if (readonly) return
    if (firstSync.current) {
      firstSync.current = false
      return
    }
    // P2-4：外部数据更新（SSE / 回滚 / 弹窗内切换卡片）覆盖草稿前，先清理备注定时器并 flush 未落库修改，
    // 避免覆盖正在输入的备注造成丢失
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    commitSave(true)
    const timer = window.setTimeout(() => setDraft(cardDraftFrom(card)), 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, readonly])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // silent=true 用于失焦/防抖自动保存：静默落地，不弹 toast，仅更新「已自动保存」角标
  // flushOnly=true 用于卸载前兜底：只调用保存回调，不 setState、不弹 toast
  function saveThrough(silent: boolean, flushOnly: boolean) {
    const c = cardRef.current
    const d = draftRef.current
    const changes = cardDraftChanges(d, c)
    const nonCodeChanged =
      changes.bodyChanged ||
      changes.titleChanged ||
      changes.tagsChanged ||
      changes.notesChanged ||
      changes.ratingChanged
    const code = normalizeCode(d.code)
    const conflict = code !== '' && props.allCodes.includes(code) && c.code !== code
    // 手动保存补建版：正文刚被失焦自动保存过（anyChanged 已为 false），
    // 但用户主动点「保存」，仍应为当前正文生成版本快照
    const needManualVersion = !silent && !flushOnly && bodyDirtyRef.current && !changes.bodyChanged && d.body === c.body
    if (!changes.anyChanged && !needManualVersion) {
      if (!silent && !flushOnly) props.notify('没有需要保存的修改')
      return
    }
    // 失焦自动保存仅存正文不建版；版本仅由手动保存 / Ctrl(⌘)+Enter 触发
    if (changes.bodyChanged) {
      props.onSaveBody(c.id, d.body, !silent)
      if (!silent) bodyDirtyRef.current = false
    } else if (needManualVersion) {
      props.onSaveBody(c.id, d.body, true)
      bodyDirtyRef.current = false
    }
    if (changes.titleChanged || changes.tagsChanged) {
      props.onUpdateMeta(c.id, d.title.trim() || c.title, parseTags(d.tagsText))
    }
    // 调取码冲突时跳过该字段，其余字段照常保存（与 PreviewPanel 语义对齐）
    if (changes.codeChanged && !conflict) props.onUpdateCode(c.id, code || null)
    if (changes.notesChanged) props.onUpdateNotes(c.id, d.notes)
    if (changes.ratingChanged) props.onRate(c.id, d.rating)
    if (flushOnly) return
    setSavedAt(Date.now())
    // 静默保存遇冲突也要给出可见提示（code 字段被跳过，其余字段已保存）
    if (conflict && changes.codeChanged) {
      props.notify('调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试')
    } else if (!silent) {
      props.notify(conflict && !nonCodeChanged ? '调取码与其他卡片冲突，请更换后再保存' : '已保存')
    }
  }

  function commitSave(silent: boolean) {
    saveThrough(silent, false)
  }

  // 卸载前兜底：清理定时器 / abort 未完成请求 / flush 未保存草稿（覆盖关闭按钮之外的外部卸载路径）
  useEffect(() => {
    return () => {
      if (notesTimer.current) window.clearTimeout(notesTimer.current)
      if (codeTipTimer.current) window.clearTimeout(codeTipTimer.current)
      metaAbortRef.current?.abort()
      summaryAbortRef.current?.abort()
      saveThrough(true, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 关闭弹窗前 flush 未保存草稿，避免 Esc / 蒙层 / 关闭按钮直接丢弃输入
  function handleClose() {
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    commitSave(true)
    props.onClose()
  }

  function handleSave() {
    commitSave(false)
  }

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
    metaAbortRef.current?.abort()
    const ac = new AbortController()
    metaAbortRef.current = ac
    setMetaLoading(true)
    try {
      const res = await fetch('/api/ai/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, existingTags: props.existingTags }),
        signal: ac.signal,
      })
      const data: { title?: string; tags?: string[]; error?: string } = await res.json()
      if (ac.signal.aborted) return
      if (!res.ok) throw new Error(data.error || '重新生成失败')
      const newTitle = data.title?.trim() || card.title
      const newTags = data.tags ?? []
      props.onUpdateMeta(card.id, newTitle, newTags)
      setDraft((d) => ({ ...d, title: newTitle, tagsText: newTags.join('、') }))
      props.notify('已重新生成标签与标题')
    } catch (e) {
      if (ac.signal.aborted) return
      props.notify(`重新生成失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      if (!ac.signal.aborted && metaAbortRef.current === ac) setMetaLoading(false)
    }
  }

  async function runSummary() {
    summaryAbortRef.current?.abort()
    const ac = new AbortController()
    summaryAbortRef.current = ac
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/ai/summarize-thinking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, prompt: props.customThinkingPrompt || null }),
        signal: ac.signal,
      })
      const data: { summary?: string; error?: string } = await res.json()
      if (ac.signal.aborted) return
      if (!res.ok) throw new Error(data.error || '总结失败')
      props.onSetSummary(card.id, data.summary ?? '')
      props.notify('思维总结已生成')
    } catch (e) {
      if (ac.signal.aborted) return
      props.notify(`总结失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      if (!ac.signal.aborted && summaryAbortRef.current === ac) setSummaryLoading(false)
    }
  }

  function handleRollback(version: Version) {
    props.onRollback(card.id, version.id)
    setDraft((d) => ({ ...d, body: version.body }))
    props.notify('已回滚到该版本')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={readonly ? '卡片详情（只读）' : '卡片详情'}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-ink-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm text-muted">详情</span>
            {readonly && (
              <span className="rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-bright">
                示例 · 只读
              </span>
            )}
            {!readonly && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void regenMeta()}
                disabled={metaLoading}
              >
                {metaLoading ? '生成中…' : '重新生成标签/标题'}
              </button>
            )}
          </div>
          <button type="button" className="btn-ghost" onClick={handleClose}>
            关闭
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {readonly ? (
            <>
              <div className="space-y-1.5">
                <p className="text-xs text-muted">标题</p>
                <p className="text-base font-medium text-paper">{card.title}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted">标签</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {card.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-gold/25 bg-gold/5 px-2 py-0.5 text-[11px] text-gold-bright"
                    >
                      {t}
                    </span>
                  ))}
                  {card.tags.length === 0 && <span className="text-xs text-muted">未打标签</span>}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted">调取码</p>
                <p className="font-mono text-sm text-gold-bright">{card.code ? `@${card.code}` : '未设置'}</p>
              </div>
              {card.notes && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted">备注</p>
                  <p className="rounded-md border border-line bg-ink-850 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-paper-dim">
                    {card.notes}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-xs text-muted">正文</p>
                <div className="rounded-md border border-line bg-ink-850 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-paper-dim">
                  {card.body}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-ink-850 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">评分</span>
                  <Stars rating={card.rating} size="md" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm text-paper">{card.copyCount}</span>
                  <span className="text-xs text-muted">次复制</span>
                </div>
                <span className="ml-auto rounded-md border border-line bg-ink-900 px-2.5 py-1 text-xs text-muted">
                  只读
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="detail-title" className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>标题（AI 生成，可手动修改，不超过 20 字）</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">{draft.title.length}/20</span>
                </label>
                <input
                  id="detail-title"
                  className="field"
                  value={draft.title}
                  maxLength={20}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  onBlur={() => commitSave(true)}
                  placeholder="一句话总结"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="detail-tags" className="text-xs text-muted">
                  标签（逗号分隔，1~3 个）
                </label>
                <input
                  id="detail-tags"
                  className="field"
                  value={draft.tagsText}
                  onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))}
                  onBlur={() => commitSave(true)}
                  placeholder="如：角色扮演、任务拆解"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="detail-code" className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>调取码（可选，英文/数字/短横线，最多 12 字符）</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">{draft.code.length}/12</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm text-gold-bright">@</span>
                  <input
                    id="detail-code"
                    className={`field flex-1 font-mono ${codeConflict ? 'border-rust/60 focus:border-rust' : ''}`}
                    value={draft.code}
                    maxLength={12}
                    onChange={(e) => handleCodeInput(e.target.value)}
                    onBlur={() => commitSave(true)}
                    placeholder="如：dee"
                  />
                </div>
                {codeConflict && (
                  <p className="text-[11px] text-rust">该调取码已被其他卡片使用，请更换</p>
                )}
                {codeFiltered && (
                  <p className="text-[11px] text-rust">仅支持英文/数字/短横线，已自动过滤</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="detail-notes" className="text-xs text-muted">
                  备注（自填 · 何时用 / 注意事项，不超过 6 行高度；可拖动加高）
                </label>
                <textarea
                  id="detail-notes"
                  rows={2}
                  placeholder="例如：适用于 X 场景；输入前请先 Y（失焦自动保存）"
                  className="field resize-y text-xs leading-relaxed"
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
              </div>
              <div className="space-y-1.5">
                <label htmlFor="detail-body" className="text-xs text-muted">
                  正文（失焦自动保存；按「保存」/ Ctrl⌘+Enter 保存并生成版本）
                </label>
                <textarea
                  id="detail-body"
                  className="field min-h-72 resize-y font-mono text-sm leading-relaxed"
                  value={draft.body}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, body: e.target.value }))
                    bodyDirtyRef.current = true
                  }}
                  onBlur={() => commitSave(true)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      handleSave()
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-ink-850 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">评分</span>
                  <Stars
                    rating={draft.rating}
                    onChange={(r) => {
                      setDraft((d) => ({ ...d, rating: r }))
                      props.onRate(card.id, r)
                    }}
                    size="md"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm text-paper">{card.copyCount}</span>
                  <span className="text-xs text-muted">次复制</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" className="btn" onClick={() => props.onCopy(card.id)}>
                    复制
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      props.onResetCopies(card.id)
                      props.notify('复制次数已清零')
                    }}
                  >
                    复制次数清零
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="rounded-lg border border-line bg-ink-850 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-serif text-sm text-paper">思维方式总结</h4>
              {!readonly && (
                <button
                  type="button"
                  className="btn-gold px-2.5 py-1 text-xs"
                  onClick={() => void runSummary()}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner className="h-3 w-3" />
                      总结中…
                    </span>
                  ) : card.thinkingSummary ? (
                    '重新生成'
                  ) : (
                    '生成总结'
                  )}
                </button>
              )}
            </div>
            {card.thinkingSummary ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-paper-dim">
                {card.thinkingSummary}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {readonly ? '该示例卡片未生成思维总结。' : '尚未生成。点击「生成总结」，AI 将分析这条提示词的思维方式并缓存结果；可在设置中自定义总结模板。'}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-line bg-ink-850 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-serif text-sm text-paper">版本历史</h4>
              <span className="font-mono text-xs text-muted">{card.versions.length} / 10</span>
            </div>
            {card.versions.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {readonly
                  ? '该示例卡片暂无版本记录。'
                  : '暂无版本记录。修改正文后点「保存」或 Ctrl/⌘+Enter 会生成快照，最多保留 10 条。'}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {[...card.versions].reverse().map((v) => {
                  const expanded = expandedVersionId === v.id
                  return (
                    <li key={v.id} className="rounded-md border border-line bg-ink-900 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 font-mono text-[11px] text-muted">{formatTime(v.createdAt)}</span>
                        <span
                          className="min-w-0 flex-1 cursor-pointer truncate text-xs text-paper-dim"
                          title="点击查看完整内容 / diff"
                          onClick={() => setExpandedVersionId(expanded ? null : v.id)}
                        >
                          {v.body}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost shrink-0"
                          onClick={() => setExpandedVersionId(expanded ? null : v.id)}
                        >
                          {expanded ? '收起' : '查看完整内容'}
                        </button>
                        {!readonly && (
                          <button
                            type="button"
                            className="btn-ghost shrink-0"
                            onClick={() => handleRollback(v)}
                          >
                            回滚
                          </button>
                        )}
                      </div>
                      {expanded && (
                        <VersionDiff
                          body={v.body}
                          currentBody={card.body}
                          className="mt-2 border-t border-line pt-2"
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <div>
            {!readonly && props.onDelete && (
              <button
                type="button"
                className="btn border-rust/40 text-rust hover:border-rust/70 hover:bg-rust/10 hover:text-rust"
                onClick={() => props.onDelete?.(card.id)}
              >
                删除卡片
              </button>
            )}
            {savedAt && <span className="ml-3 align-middle text-[11px] text-muted">· 已自动保存</span>}
          </div>
          <div className="flex items-center gap-2">
            {!readonly && (
              <>
                <button type="button" className="btn" onClick={handleClose}>
                  取消
                </button>
                <button type="button" className="btn-gold" onClick={handleSave}>
                  保存
                </button>
              </>
            )}
            {readonly && (
              <button type="button" className="btn-gold" onClick={handleClose}>
                关闭
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}