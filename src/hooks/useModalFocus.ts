import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = 'button, input, textarea, [href], select, [tabindex]:not([tabindex="-1"])'

/**
 * 模态框焦点管理（OPT-NEW-2 抽为共享 Hook）：
 * 打开时聚焦面板内首个可聚焦元素；Tab / Shift+Tab 在面板内循环；
 * 卸载时把焦点归还给打开前的元素；可选 onEscClose 处理 Esc 关闭。
 * onEscClose 经 ref 保存，避免调用方传入内联函数导致 effect 每轮重跑、焦点抖动。
 */
export function useModalFocus(
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  onEscClose?: () => void,
) {
  const escCloseRef = useRef(onEscClose)
  useEffect(() => {
    escCloseRef.current = onEscClose
  }, [onEscClose])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = () =>
      [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'))
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escCloseRef.current) {
        e.stopPropagation()
        escCloseRef.current()
        return
      }
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
