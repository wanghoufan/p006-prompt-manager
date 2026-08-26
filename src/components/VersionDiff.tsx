'use client'

import { useMemo } from 'react'
import { lineDiff } from '@/lib/diff'

interface VersionDiffProps {
  /** 版本快照正文（旧） */
  body: string
  /** 当前正文（新） */
  currentBody: string
  className?: string
}

/**
 * P3-2 版本「查看完整内容」展开后的简易 diff 高亮：
 * - 两版一致：直接展示完整正文
 * - 存在差异：逐行渲染合并 diff，del 行（旧版独有/被改）红色标注「−」，add 行（当前新增）金色标注「+」
 */
export function VersionDiff({ body, currentBody, className = '' }: VersionDiffProps) {
  const lines = useMemo(() => lineDiff(body, currentBody), [body, currentBody])
  const changed = lines.some((l) => l.kind !== 'same')

  if (!changed) {
    return (
      <p className={`whitespace-pre-wrap text-[11px] leading-relaxed text-paper-dim ${className}`}>{body}</p>
    )
  }

  return (
    <div className={`max-h-44 overflow-y-auto font-mono text-[11px] leading-relaxed ${className}`}>
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            l.kind === 'del'
              ? 'bg-rust/10 text-rust'
              : l.kind === 'add'
                ? 'text-gold-bright'
                : 'text-paper-dim'
          }
        >
          <span className="select-none pr-1">{l.kind === 'del' ? '−' : l.kind === 'add' ? '+' : ' '}</span>
          {l.text || '\u00A0'}
        </div>
      ))}
    </div>
  )
}
