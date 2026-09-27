'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  /** 不传时自动取最近一次鼠标按下的视口坐标；键盘触发（无指针）则视口居中 */
  anchor?: { x: number; y: number } | null
}

interface PendingConfirm extends ConfirmOptions {
  anchor: { x: number; y: number } | null
  resolve: (ok: boolean) => void
}

/**
 * 跟随鼠标焦点的确认弹窗，替代浏览器原生 confirm：
 * `const { confirm, dialog } = useConfirm()`；渲染 `{dialog}`，用 `await confirm({...})` 取用户选择。
 * anchor 缺省时取最近一次指针按下的坐标（键盘操作退回视口居中），无需调用方传事件。
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
    }
    // 键盘操作（回车/空格触发按钮）没有指针坐标：清空后退回视口居中
    const onKeyDown = () => {
      pointerRef.current = null
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  const close = useCallback((ok: boolean) => {
    const current = pendingRef.current
    pendingRef.current = null
    setPending(null)
    current?.resolve(ok)
  }, [])

  /** 弹出确认框；同一时刻只保留一个，后发者接管（旧的一个按取消收尾）。 */
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    pendingRef.current?.resolve(false)
    const anchor = options.anchor !== undefined ? options.anchor : pointerRef.current
    return new Promise<boolean>((resolve) => {
      const next: PendingConfirm = { ...options, anchor, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  const handleConfirm = useCallback(() => close(true), [close])
  const handleCancel = useCallback(() => close(false), [close])

  const dialog = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      description={pending.description}
      confirmText={pending.confirmText}
      cancelText={pending.cancelText}
      danger={pending.danger}
      anchor={pending.anchor}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return { confirm, dialog }
}
