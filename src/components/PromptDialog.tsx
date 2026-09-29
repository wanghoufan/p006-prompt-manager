'use client'

import { useEffect, useRef, useState } from 'react'

export interface PromptDialogProps {
  open: boolean
  title: string
  /** 补充说明：内部 \n 按 whitespace-pre-line 渲染 */
  description?: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  /** 删除 / 清空 / 覆盖类传 true（红色确认按钮 + 红色描边） */
  danger?: boolean
  /** 锚点视口坐标（鼠标位置或触发按钮 rect）；null/undefined → 视口居中 */
  anchor?: { x: number; y: number } | null
  /** 返回错误文案则阻止提交（保持弹窗打开、保留已输入内容）；返回 null 放行 */
  validate?: (value: string) => string | null
  onSubmit: (value: string) => void
  onCancel: () => void
}

/** 弹窗与视口边缘的最小留白 */
const MARGIN = 8

/** 跟随触发点的输入弹窗（替代浏览器原生 prompt）：无遮罩小浮层，点外部 / Esc / Tab 循环原生实现。 */
export function PromptDialog({
  open,
  title,
  description,
  defaultValue = '',
  placeholder,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  anchor,
  validate,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)

  // 定位：渲染后按实际尺寸量算，直接写 style（避免 setState 引发级联渲染）。
  // 未定位前先保持 hidden，避免在视口左上角闪一帧。
  useEffect(() => {
    if (!open) return
    const box = boxRef.current
    if (!box) return
    const place = () => {
      const width = box.offsetWidth
      const height = box.offsetHeight
      let top: number
      let left: number
      if (!anchor) {
        // 拿不到触发点（键盘操作等）：视口居中
        top = Math.max(MARGIN, Math.round((window.innerHeight - height) / 2))
        left = Math.max(MARGIN, Math.round((window.innerWidth - width) / 2))
      } else {
        // 左右收敛在视口内；下方空间不足时翻转到锚点上方，四周留 MARGIN
        left = Math.min(Math.max(MARGIN, anchor.x), Math.max(MARGIN, window.innerWidth - width - MARGIN))
        const below = anchor.y + MARGIN
        top = below + height + MARGIN > window.innerHeight
          ? Math.max(MARGIN, anchor.y - height - MARGIN)
          : below
      }
      box.style.top = `${top}px`
      box.style.left = `${left}px`
      box.style.visibility = 'visible'
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor])

  // 打开时焦点落到输入框（有默认值时全选，便于直接覆盖）。
  // 必须排在定位 effect 之后：定位前弹窗还是 visibility:hidden，此时 focus() 会被静默忽略。
  // 值/错误的重置不放在这里：调用方（usePrompt）每次弹出都是新挂载（并带 key），
  // 直接用 useState 初值即可，避免在 effect 里 setState 触发级联渲染。
  useEffect(() => {
    if (!open) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    if (defaultValue) el.select()
    else el.setSelectionRange(0, 0)
  }, [open, defaultValue])

  // Esc 取消 + 焦点在弹窗内 Tab 循环（输入框也在循环内；捕获阶段拦截，Esc 不再外传给页面快捷键）
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const box = boxRef.current
      if (!box) return
      const items = Array.from(
        box.querySelectorAll<HTMLElement>('textarea, input, button:not([disabled])'),
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!box.contains(active)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
        return
      }
      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onCancel])

  // 无遮罩浮层：点弹窗外即取消
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const box = boxRef.current
      if (box && e.target instanceof Node && box.contains(e.target)) return
      onCancel()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, onCancel])

  if (!open) return null

  const submit = () => {
    const message = validate ? validate(value) : null
    if (message) {
      // 校验不过：保持弹窗打开、保留已输入内容，只显示错误文案
      setError(message)
      return
    }
    setError(null)
    onSubmit(value)
  }

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ top: 0, left: 0, visibility: 'hidden', maxWidth: 'calc(100vw - 16px)' }}
      className={`fixed z-[60] rounded-xl border bg-ink-900 p-3 shadow-2xl shadow-black/50 ${
        description && description.length > 40 ? 'w-96' : 'w-80'
      } ${danger ? 'border-rust/40' : 'border-line'}`}
    >
      <p className="text-sm font-medium text-paper">{title}</p>
      {description && (
        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted">{description}</p>
      )}
      <textarea
        ref={inputRef}
        rows={2}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setValue(e.target.value)
          if (error) setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey) return
          // 中文输入法候选确认时不能当提交
          if (e.nativeEvent.isComposing) return
          e.preventDefault()
          submit()
        }}
        className="field mt-2 resize-none px-2.5 py-1.5 text-xs"
      />
      {error && <p className="mt-1 text-xs leading-relaxed text-rust">{error}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn px-2.5 py-1 text-xs" onClick={onCancel}>
          {cancelText}
        </button>
        <button
          type="button"
          className={
            danger
              ? 'rounded-md bg-rust/15 px-2.5 py-1 text-xs text-rust transition-colors hover:bg-rust/25'
              : 'btn-gold px-2.5 py-1 text-xs'
          }
          onClick={submit}
        >
          {confirmText}
        </button>
      </div>
    </div>
  )
}
