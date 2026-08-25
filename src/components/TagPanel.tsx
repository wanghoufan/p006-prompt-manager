'use client'

interface TagPanelProps {
  entries: [string, number][]
  total: number
  selected: string | null
  onSelect: (tag: string | null) => void
  /** 是否处于离线态（未连接同步服务）；undefined 表示尚未完成连接检查 */
  offline?: boolean
}

function TagRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
        active ? 'bg-gold/10 text-gold-bright' : 'text-paper-dim hover:bg-ink-800 hover:text-paper'
      }`}
    >
      <span aria-hidden className={`h-3.5 w-0.5 shrink-0 rounded-full ${active ? 'bg-gold' : 'bg-transparent'}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`shrink-0 font-mono text-xs ${active ? 'text-gold' : 'text-muted'}`}>{count}</span>
    </button>
  )
}

export function TagPanel({ entries, total, selected, onSelect, offline }: TagPanelProps) {
  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-line bg-ink-900/60">
      <div className="px-4 pb-1 pt-5 font-serif text-xs tracking-[0.2em] text-muted">标签索引</div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" aria-label="标签筛选">
        <TagRow label="全部" count={total} active={selected === null} onClick={() => onSelect(null)} />
        {entries.map(([tag, count]) => (
          <TagRow
            key={tag}
            label={tag}
            count={count}
            active={selected === tag}
            onClick={() => onSelect(selected === tag ? null : tag)}
          />
        ))}
        {entries.length === 0 && (
          <p className="px-2.5 py-3 text-xs leading-relaxed text-muted">标签会随卡片自动生成，去粘贴第一条提示词吧。</p>
        )}
      </nav>
      <div className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
        {offline
          ? '未连接同步服务，已使用本机缓存数据（不同步）'
          : '局域网实时同步（服务端共享存储），离线回退本机缓存'}
      </div>
    </aside>
  )
}