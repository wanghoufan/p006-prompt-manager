'use client'

interface StarsProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
}

export function Stars({ rating, onChange, size = 'sm' }: StarsProps) {
  const base = size === 'sm' ? 'text-sm' : 'text-lg'
  return (
    <span className={`inline-flex items-center gap-0.5 leading-none ${base}`} role="img" aria-label={`${rating} 星`}>
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
              onChange(i)
            }}
            className={`cursor-pointer transition-colors ${filled ? 'text-gold hover:text-gold-bright' : 'text-ink-700 hover:text-gold-deep'}`}
          >
            ★
          </button>
        )
      })}
    </span>
  )
}