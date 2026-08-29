export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** P1-AI1：API Key 显示脱敏，仅保留前 4 位与后 4 位，中间用 * 代替。 */
export function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '********'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}