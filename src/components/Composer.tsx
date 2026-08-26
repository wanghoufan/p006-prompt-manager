'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/Spinner'

interface ComposerProps {
  existingTags: string[]
  onCreate: (body: string, title: string, tags: string[]) => void
  notify: (msg: string) => void
}

type Phase = 'idle' | 'working' | 'error'

function Corner({ position }: { position: string }) {
  return <span aria-hidden className={`pointer-events-none absolute h-3 w-3 border-gold/70 ${position}`} />
}

export function Composer({ existingTags, onCreate, notify }: ComposerProps) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  // RISK-3：AI 请求取消控制器（新请求前 abort 上一个，卸载时 abort）
  const abortRef = useRef<AbortController | null>(null)
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
    return () => abortRef.current?.abort()
  }, [])

  async function generate(source: string) {
    if (phase === 'working') return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setPhase('working')
    setErrorMsg('')
    try {
      const res = await fetch('/api/ai/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: source, existingTags }),
        signal: ac.signal,
      })
      const data: { title?: string; tags?: string[]; error?: string } = await res.json()
      if (ac.signal.aborted) return
      if (!res.ok) throw new Error(data.error || '生成失败，请重试')
      onCreate(source, data.title ?? '', data.tags ?? [])
      setText('')
      setPhase('idle')
      notify('已创建卡片')
    } catch (e) {
      if (ac.signal.aborted) return
      setPhase('error')
      setErrorMsg(e instanceof Error ? e.message : '生成失败，请重试')
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData('text').trim()
    if (!pasted) return
    e.preventDefault()
    setText(pasted)
    void generate(pasted)
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
          rows={1}
          placeholder="在这里粘贴提示词正文，将自动生成标签与标题…"
          className="field resize-none font-mono text-[13px] leading-relaxed"
        />
      </div>

      {phase === 'working' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gold-bright">
          <Spinner />
          正在生成标签与标题…
        </div>
      )}

      {phase === 'error' && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-rust/40 bg-rust/10 px-3 py-2">
          <span className="line-clamp-2 min-w-0 text-xs text-rust" title={errorMsg}>
            生成失败：{errorMsg}
          </span>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn" onClick={() => void generate(text)}>
              重试
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                onCreate(text, '', [])
                setText('')
                setPhase('idle')
              }}
            >
              直接创建
            </button>
          </div>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between text-xs text-muted">
        <span>粘贴正文后全自动生成 · 每张卡片 1~3 个标签</span>
        {phase === 'idle' && text && (
          <button
            type="button"
            className="btn-gold px-2.5 py-1 text-xs"
            onClick={() => void generate(text)}
          >
            生成卡片
          </button>
        )}
        {phase === 'working' && <span className="text-muted">生成中…</span>}
      </div>
    </section>
  )
}