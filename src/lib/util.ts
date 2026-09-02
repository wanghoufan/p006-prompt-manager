export function uid(): string {
  const webCrypto = typeof globalThis.crypto === 'undefined' ? undefined : globalThis.crypto
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  // Supabase 主键使用 UUID。少数不支持 randomUUID 的旧环境也必须生成合法 UUID，
  // 不能退回旧版 `id-...` 字符串，否则本地创建的数据无法同步到 PostgreSQL uuid 列。
  const bytes = new Uint8Array(16)
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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
