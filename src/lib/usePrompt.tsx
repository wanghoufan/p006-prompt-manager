'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PromptDialog } from '@/components/PromptDialog'

export interface PromptOptions {
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  /** 不传时自动取最近一次鼠标按下的视口坐标；键盘触发（无指针）则视口居中 */
  anchor?: { x: number; y: number } | null
  /** 返回错误文案则阻止提交；返回 null 放行 */
  validate?: (value: string) => string | null
}

interface PendingPrompt extends PromptOptions {
  /** 每次弹出的自增序号：作为 PromptDialog 的 key，保证「后发者接管」时输入框重置而非沿用上一个值 */
  id: number
  anchor: { x: number; y: number } | null
  resolve: (value: string | null) => void
}

/**
 * 跟随鼠标焦点的输入弹窗，替代浏览器原生 prompt：
 * `const { prompt, dialog } = usePrompt()`；渲染 `{dialog}`，用 `await prompt({...})` 取用户输入。
 * 提交 → 字符串（原样，不 trim）；取消 / Esc / 点外部 → null。
 * anchor 缺省时取最近一次指针按下的坐标（键盘操作退回视口居中），无需调用方传事件。
 */
export function usePrompt() {
  const [pending, setPending] = useState<PendingPrompt | null>(null)
  const pendingRef = useRef<PendingPrompt | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const seqRef = useRef(0)

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

  const close = useCallback((value: string | null) => {
    const current = pendingRef.current
    pendingRef.current = null
    setPending(null)
    current?.resolve(value)
  }, [])

  /** 弹出输入框；同一时刻只保留一个，后发者接管（旧的一个按取消收尾）。 */
  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    pendingRef.current?.resolve(null)
    const anchor = options.anchor !== undefined ? options.anchor : pointerRef.current
    return new Promise<string | null>((resolve) => {
      const next: PendingPrompt = { ...options, id: ++seqRef.current, anchor, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  const handleSubmit = useCallback((value: string) => close(value), [close])
  const handleCancel = useCallback(() => close(null), [close])

  const dialog = pending ? (
    <PromptDialog
      key={pending.id}
      open
      title={pending.title}
      description={pending.description}
      defaultValue={pending.defaultValue}
      placeholder={pending.placeholder}
      confirmText={pending.confirmText}
      cancelText={pending.cancelText}
      danger={pending.danger}
      anchor={pending.anchor}
      validate={pending.validate}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  ) : null

  return { prompt, dialog }
}
