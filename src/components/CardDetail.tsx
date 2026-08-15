'use client'

import { useEffect, useRef, useState } from 'react'
import type { Card, Version } from '@/lib/types'
import { cardDraftChanges, cardDraftFrom, parseTags } from '@/lib/cards'
import { Stars } from '@/components/Stars'
import { Spinner } from '@/components/Spinner'
import { formatTime } from '@/lib/util'

interface CardDetailProps {
  card: Card
  readonly?: boolean
  existingTags: string[]
  customThinkingPrompt: string
  onClose: () => void
  onSaveBody: (id: string, body: string) => void
  onUpdateMeta: (id: string, title: string, tags: string[]) => void
  onRate: (id: string, rating: number) => void
  onCopy: (id: string) => void
  onResetCopies: (id: string) => void
  onRollback: (id: string, versionId: string) => void
  onSetSummary: (id: string, summary: string) => void
  onDelete?: (id: string) => void
  notify: (msg: string) => void
}

const FOCUSABLE = 'button, input, textarea, [href], select, [tabindex]:not([tabindex="-1"])'

function useModalFocus(panelRef: React.RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = () => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'))
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      const current = document.activeElement
      if (e.shiftKey && (current === first || !panel.contains(current))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (current === last || !panel.contains(current))) {
        e.preventDefault()
        first.focus()
      }
    }
    panel.addEventListener('keydown', onKey)
    return () => {
      panel.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [open, panelRef])
}

export function CardDetail(props: CardDetailProps) {
  const { card, readonly = false, onClose } = props
  const [draft, setDraft] = useState(cardDraftFrom(card))
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const firstSync = useRef(true)
  useModalFocus(panelRef, true)

  useEffect(() => {
    if (readonly) return
    if (firstSync.current) {
      firstSync.current = false
      return
    }
    const timer = window.setTimeout(() => setDraft(cardDraftFrom(card)), 0)
    return () => window.clearTimeout(timer)
  }, [card, readonly])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSave() {
    const changes = cardDraftChanges(draft, card)
    if (!changes.anyChanged) {
      props.notify('没有需要保存的修改')
      return
    }
    if (changes.bodyChanged) props.onSaveBody(card.id, draft.body)
    if (changes.titleChanged || changes.tagsChanged) {
      props.onUpdateMeta(card.id, draft.title.trim() || card.title, parseTags(draft.tagsText))
    }
    if (changes.ratingChanged) props.onRate(card.id, draft.rating)
    props.notify('已保存')
  }

  async function regenMeta() {
    setMetaLoading(true)
    try {
      const res = await fetch('/api/ai/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, existingTags: props.existingTags }),
      })
      const data: { title?: string; tags?: string[]; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || '重新生成失败')
      const newTitle = data.title?.trim() || card.title
      const newTags = data.tags ?? []
      props.onUpdateMeta(card.id, newTitle, newTags)
      setDraft((d) => ({ ...d, title: newTitle, tagsText: newTags.join('、') }))
      props.notify('已重新生成标签与标题')
    } catch (e) {
      props.notify(`重新生成失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setMetaLoading(false)
    }
  }

  async function runSummary() {
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/ai/summarize-thinking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, prompt: props.customThinkingPrompt || null }),
      })
      const data: { summary?: string; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || '总结失败')
      props.onSetSummary(card.id, data.summary ?? '')
      props.notify('思维总结已生成')
    } catch (e) {
      props.notify(`总结失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setSummaryLoading(false)
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
      onClick={onClose}
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
          <button type="button" className="btn-ghost" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
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
                <p className="text-xs text-muted">正文</p>
                <div className="rounded-md border border-line bg-ink-850 px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-paper-dim">
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
                <label htmlFor="detail-title" className="text-xs text-muted">
                  标题（AI 生成，可手动修改，不超过 20 字）
                </label>
                <input
                  id="detail-title"
                  className="field"
                  value={draft.title}
                  maxLength={20}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
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
                  placeholder="如：角色扮演、任务拆解"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="detail-body" className="text-xs text-muted">
                  正文（修改后按「保存」或 Ctrl/⌘ + Enter 生成版本）
                </label>
                <textarea
                  id="detail-body"
                  className="field min-h-56 resize-y font-mono text-[13px] leading-relaxed"
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
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
                    onChange={(r) => setDraft((d) => ({ ...d, rating: r }))}
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
                  : '暂无版本记录。修改正文后点「保存」，会自动生成正文快照，最多保留 10 条。'}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {[...card.versions].reverse().map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 rounded-md border border-line bg-ink-900 px-3 py-2"
                  >
                    <span className="shrink-0 font-mono text-[11px] text-muted">{formatTime(v.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-paper-dim" title={v.body}>
                      {v.body}
                    </span>
                    {!readonly && (
                      <button
                        type="button"
                        className="btn-ghost shrink-0"
                        onClick={() => handleRollback(v)}
                      >
                        回滚
                      </button>
                    )}
                  </li>
                ))}
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
          </div>
          <div className="flex items-center gap-2">
            {!readonly && (
              <>
                <button type="button" className="btn" onClick={onClose}>
                  取消
                </button>
                <button type="button" className="btn-gold" onClick={handleSave}>
                  保存
                </button>
              </>
            )}
            {readonly && (
              <button type="button" className="btn-gold" onClick={onClose}>
                关闭
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}