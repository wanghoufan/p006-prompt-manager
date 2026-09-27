'use client'

import { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** 补充说明：内部 \n 按 whitespace-pre-line 渲染 */
  description?: string
  confirmText?: string
  cancelText?: string
  /** 删除 / 清空 / 覆盖类传 true（红色确认按钮 + 红色描边） */
  danger?: boolean
  /** 锚点视口坐标（鼠标位置或触发按钮 rect）；null/undefined → 视口居中 */
  anchor?: { x: number; y: number } | null
  onConfirm: () => void
  onCancel: () => void
}

/** 弹窗与视口边缘的最小留白 */
const MARGIN = 8

/** 跟随触发点的确认弹窗（替代浏览器原生 confirm）：无遮罩小浮层，点外部 / Esc / Tab 循环原生实现。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  anchor,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

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

  // 打开时焦点落到确认按钮：键盘用户可直接回车确认
  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
  }, [open])

  // Esc 取消 + 焦点在弹窗内 Tab 循环（捕获阶段拦截，Esc 不再外传给页面快捷键）
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
      const items = Array.from(box.querySelectorAll<HTMLElement>('button:not([disabled])'))
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

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ top: 0, left: 0, visibility: 'hidden' }}
      className={`fixed z-[60] rounded-xl border bg-ink-900 p-3 shadow-2xl shadow-black/50 ${
        description && description.length > 40 ? 'w-96' : 'w-80'
      } ${danger ? 'border-rust/40' : 'border-line'}`}
    >
      <p className="text-sm font-medium text-paper">{title}</p>
      {description && (
        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted">{description}</p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn px-2.5 py-1 text-xs" onClick={onCancel}>
          {cancelText}
        </button>
        <button
          ref={confirmRef}
          type="button"
          className={
            danger
              ? 'rounded-md bg-rust/15 px-2.5 py-1 text-xs text-rust transition-colors hover:bg-rust/25'
              : 'btn-gold px-2.5 py-1 text-xs'
          }
          onClick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  )
}
