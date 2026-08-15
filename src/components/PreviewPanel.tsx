'use client'

import { useEffect, useRef, useState } from 'react'
import type { Card, Version } from '@/lib/types'
import { cardDraftChanges, cardDraftFrom, parseTags } from '@/lib/cards'
import type { CardDraft } from '@/lib/cards'
import { Stars } from '@/components/Stars'
import { Spinner } from '@/components/Spinner'
import { formatTime } from '@/lib/util'

interface PreviewPanelProps {
  card: Card | null
  readonly?: boolean
  existingTags: string[]
  customThinkingPrompt: string
  onCopy: () => void
  onRate: (rating: number) => void
  onSaveBody: (id: string, body: string) => void
  onUpdateMeta: (id: string, title: string, tags: string[]) => void
  onResetCopies: (id: string) => void
  onRollback: (id: string, versionId: string) => void
  onSetSummary: (id: string, summary: string) => void
  onDelete?: (id: string) => void
  notify: (msg: string) => void
}

export function PreviewPanel({
  card,
  readonly = false,
  existingTags,
  customThinkingPrompt,
  onCopy,
  onRate,
  onSaveBody,
  onUpdateMeta,
  onResetCopies,
  onRollback,
  onSetSummary,
  onDelete,
  notify,
}: PreviewPanelProps) {
  const [draft, setDraft] = useState<CardDraft>(() =>
    card ? cardDraftFrom(card) : { title: '', tagsText: '', body: '', rating: 0 },
  )
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const firstSync = useRef(true)

  useEffect(() => {
    if (!card) return
    if (firstSync.current) {
      firstSync.current = false
      return
    }
    const timer = window.setTimeout(() => setDraft(cardDraftFrom(card)), 0)
    return () => window.clearTimeout(timer)
  }, [card])

  function handleSave() {
    if (!card) return
    const changes = cardDraftChanges(draft, card)
    if (!changes.anyChanged) {
      notify('没有需要保存的修改')
      return
    }
    if (changes.bodyChanged) onSaveBody(card.id, draft.body)
    if (changes.titleChanged || changes.tagsChanged) {
      onUpdateMeta(card.id, draft.title.trim() || card.title, parseTags(draft.tagsText))
    }
    if (changes.ratingChanged) onRate(draft.rating)
    notify('已保存')
  }

  async function regenMeta() {
    if (!card) return
    setMetaLoading(true)
    try {
      const res = await fetch('/api/ai/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, existingTags }),
      })
      const data: { title?: string; tags?: string[]; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || '重新生成失败')
      const newTitle = data.title?.trim() || card.title
      const newTags = data.tags ?? []
      onUpdateMeta(card.id, newTitle, newTags)
      setDraft((d) => ({ ...d, title: newTitle, tagsText: newTags.join('、') }))
      notify('已重新生成标签与标题')
    } catch (e) {
      notify(`重新生成失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setMetaLoading(false)
    }
  }

  async function runSummary() {
    if (!card) return
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/ai/summarize-thinking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: card.body, prompt: customThinkingPrompt || null }),
      })
      const data: { summary?: string; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || '总结失败')
      onSetSummary(card.id, data.summary ?? '')
      notify('思维总结已生成')
    } catch (e) {
      notify(`总结失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setSummaryLoading(false)
    }
  }

  function handleRollback(version: Version) {
    if (!card) return
    onRollback(card.id, version.id)
    notify('已回滚到该版本')
  }

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-ink-900 md:flex">
      {!card ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-2xl">⚡</span>
          <p className="text-xs leading-relaxed text-muted">
            点击左侧卡片，在此预览与编辑提示词
          </p>
        </div>
      ) : readonly ? (
        <>
          <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <h3 className="min-w-0 flex-1 font-serif text-sm text-paper" title={card.title}>
              {card.title}
            </h3>
            <span className="shrink-0 rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-bright">
              示例 · 只读
            </span>
          </header>
          <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
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
          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-paper-dim">
            {card.body}
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] text-muted">思维方式总结</h4>
              {card.thinkingSummary && (
                <span className="text-[10px] text-muted">已生成</span>
              )}
            </div>
            <p className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-paper-dim">
              {card.thinkingSummary ?? '该示例卡片未生成思维总结。'}
            </p>
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] text-muted">
                版本历史 <span className="font-mono">{card.versions.length} / 10</span>
              </h4>
            </div>
            {card.versions.length === 0 ? (
              <p className="mt-1.5 text-xs leading-relaxed text-muted">该示例卡片暂无版本记录。</p>
            ) : (
              <ul className="mt-1.5 max-h-28 space-y-1.5 overflow-y-auto">
                {[...card.versions].reverse().map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-md border border-line bg-ink-850 px-2 py-1.5">
                    <span className="shrink-0 font-mono text-[10px] text-muted">{formatTime(v.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-paper-dim" title={v.body}>
                      {v.body}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
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
          <header className="border-b border-line px-4 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="preview-title" className="text-[10px] text-muted">
                  标题
                </label>
                <input
                  id="preview-title"
                  className="field mt-1 border-transparent bg-transparent px-0 py-0.5 font-serif text-sm text-paper focus:border-transparent"
                  value={draft.title}
                  maxLength={20}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="一句话总结"
                />
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0 text-[11px]"
                onClick={() => void regenMeta()}
                disabled={metaLoading}
              >
                {metaLoading ? '生成中…' : '重新生成标签/标题'}
              </button>
            </div>
          </header>
          <div className="border-b border-line px-4 py-2.5">
            <label htmlFor="preview-tags" className="text-[10px] text-muted">
              标签（逗号分隔，1~3 个）
            </label>
            <input
              id="preview-tags"
              className="field mt-1"
              value={draft.tagsText}
              onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))}
              placeholder="如：角色扮演、任务拆解"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-4 py-2.5">
            <label htmlFor="preview-body" className="text-[10px] text-muted">
              正文（修改后点「保存」或 Ctrl/⌘ + Enter 生成版本）
            </label>
            <textarea
              id="preview-body"
              className="field mt-1 min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed"
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
          <div className="border-t border-line px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] text-muted">思维方式总结</h4>
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
            <p className="mt-1.5 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-paper-dim">
              {card.thinkingSummary ?? '尚未生成。AI 将分析这条提示词的思维方式并缓存结果。'}
            </p>
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <h4 className="text-[11px] text-muted">
              版本历史 <span className="font-mono">{card.versions.length} / 10</span>
            </h4>
            {card.versions.length === 0 ? (
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                暂无版本记录。修改正文后点「保存」，会自动生成正文快照。
              </p>
            ) : (
              <ul className="mt-1.5 max-h-28 space-y-1.5 overflow-y-auto">
                {[...card.versions].reverse().map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-2 rounded-md border border-line bg-ink-850 px-2 py-1.5"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-muted">{formatTime(v.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-paper-dim" title={v.body}>
                      {v.body}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 text-[10px]"
                      onClick={() => handleRollback(v)}
                    >
                      回滚
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Stars
                rating={draft.rating}
                onChange={(r) => setDraft((d) => ({ ...d, rating: r }))}
              />
              <span className="font-mono text-xs text-muted">
                {card.copyCount} <span className="text-[10px]">次复制</span>
              </span>
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
          {onDelete && (
            <div className="border-t border-line px-4 py-2">
              <button
                type="button"
                className="btn w-full border-rust/40 py-1 text-[10px] text-rust hover:border-rust/70 hover:bg-rust/10 hover:text-rust"
                onClick={() => onDelete(card.id)}
              >
                删除卡片
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  )
}