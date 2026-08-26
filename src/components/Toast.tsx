'use client'

export interface ToastAction {
  label: string
  onClick: () => void
}

export function Toast({
  message,
  detail,
  action,
}: {
  message: string | null
  detail?: string[] | null
  action?: ToastAction | null
}) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 flex-col items-center gap-2">
      <div
        key={message + (action?.label ?? '')}
        className="flex animate-[toast-in_0.18s_ease-out] items-center gap-3 rounded-full border border-line bg-ink-800 py-2 pl-4 pr-2 text-sm text-paper shadow-lg shadow-black/40"
      >
        <span>{message}</span>
        {action && (
          <button
            type="button"
            className="shrink-0 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-medium text-gold-bright transition-colors hover:bg-gold/25 focus-visible:bg-gold/25"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
      </div>
      {detail && detail.length > 0 && (
        <div className="animate-[toast-in_0.18s_ease-out] max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-ink-800 px-3 py-2 text-left text-xs leading-relaxed text-muted shadow-lg shadow-black/40">
          {detail.map((d, i) => (
            <div key={i} className="py-0.5">
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
