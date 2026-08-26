'use client'

export function Toast({ message, detail }: { message: string | null; detail?: string[] | null }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 flex-col items-center gap-2">
      <div
        key={message}
        className="animate-[toast-in_0.18s_ease-out] rounded-full border border-line bg-ink-800 px-4 py-2 text-sm text-paper shadow-lg shadow-black/40"
      >
        {message}
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
