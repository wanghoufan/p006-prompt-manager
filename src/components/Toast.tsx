'use client'

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      key={message}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[toast-in_0.18s_ease-out] rounded-full border border-line bg-ink-800 px-4 py-2 text-sm text-paper shadow-lg shadow-black/40"
    >
      {message}
    </div>
  )
}