'use client'

import { useEffect, useRef, useState } from 'react'
import { aiRequestHeaders } from '@/lib/aiClient'

interface ComposerProps {
  existingTags: string[]
  addMode: 'auto' | 'manual'
  autoFormatBody: boolean
  composerAutoTags: boolean
  composerAutoTitle: boolean
  bodyAlignment: 'left' | 'center' | 'right'
  /** 开关变更回调：写入全局 settings 走持久化（autoTags→composerAutoTags、autoTitle→composerAutoTitle、autoFormat→autoFormatBody）。 */
  onComposerOptionsChange: (patch: { autoTags?: boolean; autoTitle?: boolean; autoFormat?: boolean }) => void
  onCreate: (body: string, title: string, tags: string[]) => Promise<string | null>
  onApplyGeneratedMeta: (id: string, title: string, tags: string[], generateTitle: boolean, generateTags: boolean) => void
  notify: (msg: string) => void
}

function Corner({ position }: { position: string }) {
  return <span aria-hidden className={`pointer-events-none absolute h-3 w-3 border-gold/70 ${position}`} />
}

export function Composer({ existingTags, addMode, autoFormatBody, composerAutoTags, composerAutoTitle, bodyAlignment, onComposerOptionsChange, onCreate, onApplyGeneratedMeta, notify }: ComposerProps) {
  const [text, setText] = useState('')
  // 三个开关均为全局 settings 的受控视图（持久化见 onComposerOptionsChange），不再持有本地 state
  const autoGenerateTags = composerAutoTags
  const autoGenerateTitle = composerAutoTitle
  const autoFormat = autoFormatBody
  const [submitting, setSubmitting] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'complete'>('idle')
  const [generationLabel, setGenerationLabel] = useState('标题与标签')
  const abortControllersRef = useRef(new Set<AbortController>())
  const activeGenerationsRef = useRef(0)
  const completionTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // P3-4：autoResize 至 maxRows=6，粘贴长文自动展开，避免手动拖高
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const cs = window.getComputedStyle(ta)
    const lineHeight = parseFloat(cs.lineHeight) || 20
    const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const maxHeight = lineHeight * 6 + paddingY
    ta.style.maxHeight = `${maxHeight}px`
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`
  }, [text])

  useEffect(() => {
    mountedRef.current = true
    const controllers = abortControllersRef.current
    return () => {
      mountedRef.current = false
      controllers.forEach((controller) => controller.abort())
      if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current)
    }
  }, [])

  function beginGeneration(generateTitle: boolean, generateTags: boolean) {
    activeGenerationsRef.current += 1
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current)
      completionTimerRef.current = null
    }
    setGenerationLabel(generateTitle && generateTags ? '标题与标签' : generateTitle ? '标题' : '标签')
    setGenerationStatus('generating')
  }

  function finishGeneration() {
    activeGenerationsRef.current -= 1
    if (activeGenerationsRef.current > 0 || !mountedRef.current) return
    setGenerationStatus('complete')
    completionTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setGenerationStatus('idle')
      completionTimerRef.current = null
    }, 2000)
  }

  async function enrichCard(id: string, source: string, generateTitle: boolean, generateTags: boolean) {
    if (!generateTitle && !generateTags) return
    const controller = new AbortController()
    abortControllersRef.current.add(controller)
    beginGeneration(generateTitle, generateTags)
    try {
      const res = await fetch('/api/ai/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiRequestHeaders() },
        body: JSON.stringify({ body: source, existingTags }),
        signal: controller.signal,
      })
      let data: { title?: string; tags?: string[]; error?: string }
      try {
        data = await res.json()
      } catch {
        throw new Error('AI 服务返回了无法识别的响应，请稍后重试')
      }
      if (controller.signal.aborted) return
      if (!res.ok) throw new Error(data.error || 'AI 自动生成暂不可用，请稍后重试')
      onApplyGeneratedMeta(id, data.title ?? '', data.tags ?? [], generateTitle, generateTags)
    } catch (error) {
      if (!controller.signal.aborted) {
        notify(`卡片已创建；${error instanceof Error ? error.message : '标题与标签补全失败'}。你可在详情中手动补充。`)
      }
    } finally {
      abortControllersRef.current.delete(controller)
      finishGeneration()
    }
  }

  async function createCard(source: string) {
    if (submitting) return
    const raw = source.trim()
    if (!raw) return
    setSubmitting(true)
    let body = raw
    if (autoFormat) {
      try {
        const res = await fetch('/api/ai/format-body', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...aiRequestHeaders() },
          body: JSON.stringify({ body: raw, alignment: bodyAlignment }),
        })
        const data: { body?: string; error?: string } = await res.json()
        if (!res.ok) throw new Error(data.error || '格式整理失败')
        if (typeof data.body === 'string' && data.body.trim()) body = data.body.trim()
      } catch (e) {
        notify(`自动格式整理失败，已使用原文：${e instanceof Error ? e.message : '未知错误'}`)
      }
    }
    const generateTitle = autoGenerateTitle
    const generateTags = autoGenerateTags
    const id = await onCreate(body, '', [])
    if (!id) { setSubmitting(false); return }
    setText('')
    notify('已创建卡片')
    void enrichCard(id, body, generateTitle, generateTags)
    setSubmitting(false)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (addMode !== 'auto') return
    const pasted = e.clipboardData.getData('text')
    if (!pasted.trim()) return
    e.preventDefault()
    createCard(pasted)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    createCard(text)
  }

  return (
    <section className="rounded-xl border border-line bg-ink-900/40 p-3">
      <div className="relative">
        <Corner position="-left-1.5 -top-1.5 border-l-2 border-t-2" />
        <Corner position="-right-1.5 -top-1.5 border-r-2 border-t-2" />
        <Corner position="-bottom-1.5 -left-1.5 border-b-2 border-l-2" />
        <Corner position="-bottom-1.5 -right-1.5 border-b-2 border-r-2" />
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={addMode === 'auto' ? '在这里粘贴提示词正文，将立即创建卡片…' : '在这里粘贴或输入提示词正文…'}
          className="field resize-none font-mono text-[13px] leading-relaxed"
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span>粘贴正文后全自动生成</span>
          <label className="flex cursor-pointer items-center gap-1.5 text-paper-dim">
            <input
              type="checkbox"
              checked={autoGenerateTags}
              onChange={(e) => onComposerOptionsChange({ autoTags: e.target.checked })}
              className="accent-gold"
            />
            自动生成标签
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-paper-dim">
            <input
              type="checkbox"
              checked={autoGenerateTitle}
              onChange={(e) => onComposerOptionsChange({ autoTitle: e.target.checked })}
              className="accent-gold"
            />
            自动生成标题
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-paper-dim">
            <input
              type="checkbox"
              checked={autoFormat}
              onChange={(e) => onComposerOptionsChange({ autoFormat: e.target.checked })}
              className="accent-gold"
            />
            自动格式整理
          </label>
        </div>
        <button
          type="button"
          className="btn-gold px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!text.trim() || submitting}
          onClick={() => createCard(text)}
        >
          {submitting ? '生成中…' : '生成卡片 (Enter)'}
        </button>
      </div>
      {generationStatus !== 'idle' && (
        <p aria-live="polite" className="mt-2 text-xs text-gold-bright">
          {generationStatus === 'generating'
            ? `正在生成${generationLabel}…`
            : '已完成'}
        </p>
      )}
    </section>
  )
}
