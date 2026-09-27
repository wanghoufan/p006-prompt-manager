'use client'

import { formatTime } from '@/lib/util'
import type { TrashEntry } from '@/lib/trash'
import { useConfirm } from '@/lib/useConfirm'

interface TrashModalProps {
  entries: TrashEntry[]
  onRestore: (id: string) => void
  onEmpty: () => void
  onClose: () => void
}

function entryDetail(entry: TrashEntry): string {
  if (entry.kind === 'card') {
    const n = entry.cards.length
    return `${n} 张卡片 · ${entry.relations.length} 条关联`
  }
  return `${entry.tags.length} 个标签 · ${entry.relations.length} 条关联`
}

export function TrashModal({ entries, onRestore, onEmpty, onClose }: TrashModalProps) {
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="回收站"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-ink-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-serif text-sm text-paper">
            回收站
            <span className="ml-2 font-mono text-[11px] text-muted">{entries.length} 项</span>
          </h2>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                className="btn-ghost text-xs text-rust hover:bg-rust/10"
                onClick={async () => {
                  if (
                    await askConfirm({
                      title: '确定清空回收站？',
                      description: `共 ${entries.length} 项，清空后无法恢复。`,
                      danger: true,
                    })
                  ) {
                    onEmpty()
                  }
                }}
              >
                清空
              </button>
            )}
            <button type="button" className="btn-ghost text-xs" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-xs leading-relaxed text-muted">
              回收站是空的。
              <br />
              删除卡片或标签后会先到这里，点恢复可拿回，清空后彻底删除。
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-ink-850 px-3 py-2"
                >
                  <span aria-hidden className="text-base">
                    {entry.kind === 'card' ? '🗂️' : '🏷️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-paper" title={entry.title}>
                      {entry.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">
                      {entryDetail(entry)} · {formatTime(entry.deletedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn shrink-0 px-2.5 py-1 text-xs"
                    onClick={() => onRestore(entry.id)}
                  >
                    恢复
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="border-t border-line px-4 py-2 text-[10px] leading-relaxed text-muted/70">
          回收站只保存在本机浏览器；恢复的内容会重新同步到云端。
        </p>
        {confirmDialog}
      </div>
    </div>
  )
}
