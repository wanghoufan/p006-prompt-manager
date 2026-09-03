'use client'

import { useCallback, useEffect, useState } from 'react'
import { buildMcpEnvText, createMcpAccessToken, listMcpAccessTokens, revokeMcpAccessToken, type McpAccessTokenInfo } from '@/lib/supabase/mcpTokens'

function formatDate(value: string | null): string {
  if (!value) return '尚未使用'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

async function copyTextWithFallback(value: string): Promise<void> {
  // Clipboard API 仅在安全上下文（HTTPS / localhost）中可用；局域网 HTTP 用选区复制兜底。
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // 某些浏览器即使处于安全上下文也可能拒绝权限，继续尝试用户点击触发的兼容路径。
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.append(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  try {
    if (!document.execCommand('copy')) throw new Error('复制命令被浏览器拒绝')
  } finally {
    textarea.remove()
  }
}

export function McpCloudAccess() {
  const [tokens, setTokens] = useState<McpAccessTokenInfo[]>([])
  const [label, setLabel] = useState('这台电脑')
  const [oneTimeEnv, setOneTimeEnv] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setTokens(await listMcpAccessTokens())
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '无法读取 MCP 访问令牌')
    }
  }, [])

  useEffect(() => {
    // 延迟到计时器回调，避免在 effect 同步阶段触发状态更新。
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function createToken() {
    setBusy(true)
    setStatus('')
    try {
      const { token, info } = await createMcpAccessToken(label)
      const env = buildMcpEnvText(token)
      if (!env) throw new Error('Supabase 公共配置尚未完成')
      setOneTimeEnv(env)
      setTokens((current) => [info, ...current])
      setStatus('已生成。请立即复制下方内容；关闭或刷新后不会再显示令牌。')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '创建 MCP 访问令牌失败')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setBusy(true)
    setStatus('')
    try {
      await revokeMcpAccessToken(id)
      setTokens((current) => current.map((token) => token.id === id ? { ...token, revokedAt: new Date().toISOString() } : token))
      setOneTimeEnv(null)
      setStatus('该设备的 MCP 访问已撤销。')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '撤销 MCP 访问令牌失败')
    } finally {
      setBusy(false)
    }
  }

  async function copyEnv() {
    if (!oneTimeEnv) return
    try {
      await copyTextWithFallback(oneTimeEnv)
      setStatus('已复制。请粘贴到该电脑 mcp/prompt-server/.env.local 文件中。')
    } catch {
      setStatus('复制失败，请检查浏览器剪贴板权限。')
    }
  }

  return (
    <div className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
      <p className="text-sm text-paper">MCP 云端访问</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">
        为每台使用 MCP 的电脑生成一枚独立令牌。令牌可单独撤销，MCP 只可调取你的云端提示词，不使用 Supabase 管理员密钥。
      </p>
      <label htmlFor="mcp-device-label" className="mt-3 block text-xs text-muted">设备名称</label>
      <div className="mt-1 flex gap-2">
        <input id="mcp-device-label" className="field min-w-0 flex-1" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />
        <button type="button" className="btn-gold shrink-0" onClick={() => void createToken()} disabled={busy}>
          {busy ? '处理中…' : '生成令牌'}
        </button>
      </div>
      {oneTimeEnv && (
        <div className="mt-3 rounded-md border border-gold/30 bg-ink-850 p-2">
          <p className="text-xs text-gold">一次性密钥内容（仅此一次显示）</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-paper-dim">{oneTimeEnv}</pre>
          <button type="button" className="btn mt-2 text-xs" onClick={() => void copyEnv()}>复制到剪贴板</button>
        </div>
      )}
      {status && <p role="status" className="mt-2 text-xs text-muted">{status}</p>}
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        {tokens.length === 0 ? (
          <p className="text-xs text-muted">还没有 MCP 访问令牌。</p>
        ) : tokens.map((token) => (
          <div key={token.id} className="flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="truncate text-paper-dim">{token.label}{token.revokedAt ? '（已撤销）' : ''}</p>
              <p className="text-muted">创建：{formatDate(token.createdAt)} · 上次使用：{formatDate(token.lastUsedAt)}</p>
            </div>
            {!token.revokedAt && <button type="button" className="btn-ghost shrink-0 text-rust" onClick={() => void revoke(token.id)} disabled={busy}>撤销</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
