'use client'

import { useRef } from 'react'

interface StarsProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
}

// 键盘激活（Enter/Space）产生的 click 没有指针坐标，detail 为 0；指针点击/触摸 tap 都带真实坐标。
function isPointerActivation(e: React.MouseEvent) {
  return e.detail > 0 || e.clientX !== 0 || e.clientY !== 0
}

// 各星热区（26px）比星间距（16px）宽，相邻热区重叠 10px；命中判定不能信 paint order，
// 一律取「点击横坐标离哪颗星字形中心最近」。button 左右 padding 对称，rect 中心即字形中心。
function nearestStarIndex(container: HTMLSpanElement | null, x: number) {
  const buttons = container?.querySelectorAll('button')
  if (!buttons || buttons.length === 0) return null
  let nearest = 1
  let minDistance = Number.POSITIVE_INFINITY
  buttons.forEach((button, index) => {
    const rect = button.getBoundingClientRect()
    const distance = Math.abs(x - (rect.left + rect.width / 2))
    if (distance < minDistance) {
      minDistance = distance
      nearest = index + 1
    }
  })
  return nearest
}

export function Stars({ rating, onChange, size = 'sm' }: StarsProps) {
  const base = size === 'sm' ? 'text-sm' : 'text-lg'
  const containerRef = useRef<HTMLSpanElement>(null)

  const handleClickCapture = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (!onChange || !isPointerActivation(e)) return
    const nearest = nearestStarIndex(containerRef.current, e.clientX)
    if (nearest !== null) onChange(nearest)
  }

  return (
    <span
      ref={containerRef}
      className={`inline-flex items-center gap-0.5 leading-none ${base}`}
      role="img"
      aria-label={`${rating} 星`}
      onClickCapture={onChange ? handleClickCapture : undefined}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= rating
        if (!onChange) {
          return (
            <span key={i} className={filled ? 'text-gold' : 'text-ink-700'}>
              ★
            </span>
          )
        }
        return (
          <button
            key={i}
            type="button"
            title={`${i} 星`}
            aria-label={`${i} 星`}
            onClick={(e) => {
              e.stopPropagation()
              if (isPointerActivation(e)) return
              onChange(i)
            }}
            className={`relative cursor-pointer px-1.5 py-1 -mx-1.5 -my-1 transition-colors hover:z-10 focus-visible:z-10 ${filled ? 'text-gold hover:text-gold-bright' : 'text-ink-700 hover:text-gold-deep'}`}
          >
            ★
          </button>
        )
      })}
    </span>
  )
}
