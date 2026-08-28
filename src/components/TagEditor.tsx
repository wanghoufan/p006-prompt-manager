'use client'

import { useMemo, useRef, useState } from 'react'
import { parseTags } from '@/lib/cards'

interface TagEditorProps {
  /** 当前标签文本（draft.tagsText），组件据此渲染 chip 列表并作双向同步 */
  value: string
  /** 已存在标签全集，用于下拉补全 */
  existingTags: string[]
  /** 标签集合变更回写：调用方需同时 setDraft(tagsText=next.join('、')) 与 onUpdateMeta(id, title, next) */
  onChange: (nextTags: string[]) => void
  /** 最多标签数，默认 10 */
  max?: number
  placeholder?: string
  inputId?: string
}

/**
 * flomo 风格标签编辑器：chip 列表（上方）+ input（# 前缀）+ 下拉补全（existingTags）。
 * - 输入 `#标签名` 后回车 / 空格 即添加一个 chip，不影响已添加标签
 * - 输入时弹出已有标签补全，点选 / 回车 即添加
 * - chip 上 × 移除单个标签
 * - 与 handleUpdateMeta 的 tagsText 编辑链路兼容：onChange 始终回写 next.join('、')
 */
export function TagEditor({
  value,
  existingTags,
  onChange,
  max = 10,
  placeholder = '输入 #标签名 后按回车/空格添加',
  inputId,
}: TagEditorProps) {
  const chips = useMemo(() => parseTags(value), [value])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const isComposingRef = useRef(false)

  const atMax = chips.length >= max

  const suggestions = useMemo(() => {
    const q = input.replace(/^#+/, '').trim().toLowerCase()
    if (!q) return []
    return existingTags.filter((t) => !chips.includes(t) && t.toLowerCase().includes(q)).slice(0, 8)
  }, [input, existingTags, chips])

  function addTag(raw: string) {
    const name = raw.replace(/^#+/, '').trim()
    if (!name || atMax || chips.includes(name)) {
      setInput('')
      setOpen(false)
      setHighlight(-1)
      return
    }
    const next = [...chips, name].slice(0, max)
    onChange(next)
    setInput('')
    setOpen(false)
    setHighlight(-1)
  }

  function removeTag(name: string) {
    onChange(chips.filter((t) => t !== name))
  }

  return (
    <div className="space-y-1.5">
      {/* chip 列表（输入框上方展示） */}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.length === 0 ? (
          <span className="text-xs text-muted">暂无标签</span>
        ) : (
          chips.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/5 px-2 py-0.5 text-[11px] text-gold-bright"
            >
              {t}
              <button
                type="button"
                aria-label={`移除标签 ${t}`}
                title={`移除标签「${t}」`}
                className="rounded-full p-0.5 text-muted transition-colors hover:bg-gold/20 hover:text-rust"
                onClick={() => removeTag(t)}
              >
                <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      {/* 输入框 + 下拉补全 */}
      <div className="relative">
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-sm text-gold/60"
          aria-hidden
        >
          #
        </span>
        <input
          id={inputId}
          className="field pl-7"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setOpen(true)
            setHighlight(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // suggestion 的 mousedown 已 preventDefault 阻止 blur，此处兜底提交未输入完的标签
            if (!isComposingRef.current && input.trim()) addTag(input)
            else setOpen(false)
          }}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false
            setInput(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || isComposingRef.current) return
            if (e.key === 'Enter') {
              e.preventDefault()
              if (highlight >= 0 && suggestions[highlight]) addTag(suggestions[highlight])
              else addTag(input)
            } else if (e.key === ' ') {
              e.preventDefault()
              addTag(input)
            } else if (e.key === 'ArrowDown') {
              if (suggestions.length) {
                e.preventDefault()
                setHighlight((h) => Math.min(suggestions.length - 1, h + 1))
              }
            } else if (e.key === 'ArrowUp') {
              if (suggestions.length) {
                e.preventDefault()
                setHighlight((h) => Math.max(0, h - 1))
              }
            } else if (e.key === 'Escape') {
              setOpen(false)
              setHighlight(-1)
            }
          }}
          placeholder={placeholder}
          aria-label="添加标签"
        />
        {open && suggestions.length > 0 && !atMax && (
          <ul
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-ink-850 py-1 text-xs shadow-xl shadow-black/40"
            onMouseDown={(e) => e.preventDefault()}
          >
            {suggestions.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  className={`block w-full px-3 py-1.5 text-left text-paper-dim transition-colors hover:bg-ink-800 hover:text-paper ${
                    i === highlight ? 'bg-ink-800 text-paper' : ''
                  }`}
                  onClick={() => addTag(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {atMax && <p className="text-[11px] text-rust">已达上限（最多 10 个）</p>}
    </div>
  )
}
