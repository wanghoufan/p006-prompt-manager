'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { getSupabasePublicConfig } from '@/lib/supabase/config'

type LoginState = 'idle' | 'sending' | 'sent' | 'error'

/**
 * 迁移阶段的最小登录入口。
 * 登录成功只建立 Supabase Auth 会话；业务数据仍由后续 Repository + RLS 迁移接管。
 */
export function SupabaseAuthControl() {
  const configured = getSupabasePublicConfig() !== null
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [state, setState] = useState<LoginState>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      // 页面中的数据连接器据此重新选择 Supabase 或本地兜底，避免用户登录后
      // 还必须手动刷新页面才能看到云端内容。
      window.dispatchEvent(new Event('prompt-manager-auth-changed'))
      if (session?.user) {
        setOpen(false)
        setState('idle')
        setMessage('')
      }
    })

    // 必须先订阅，再读取当前用户。OAuth 回跳会在客户端初始化时异步交换
    // PKCE code；若顺序反过来，快速回跳可能错过 SIGNED_IN 事件。
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setState('error')
        setMessage('无法读取登录状态，请稍后重试')
        return
      }
      setUser(data.user)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function sendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const normalizedEmail = email.trim()
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !normalizedEmail) return

    setState('sending')
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setState('error')
      setMessage(error.message)
      return
    }
    setState('sent')
    setMessage('登录链接已发送，请在此设备打开邮件中的链接。')
  }

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    setState('sending')
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setState('error')
      setMessage(error.message)
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    await supabase.auth.signOut()
  }

  if (!configured) return null

  if (user) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="hidden max-w-40 truncate text-xs text-muted sm:inline" title={user.email ?? undefined}>
          {user.email ?? '已登录云端'}
        </span>
        <button type="button" className="btn-ghost" onClick={() => void signOut()}>
          退出云端
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button type="button" className="btn" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        云端登录
      </button>
      {open && (
        <form
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-lg border border-line bg-ink-900 p-3 shadow-xl"
          onSubmit={(e) => void sendMagicLink(e)}
        >
          <p className="text-sm font-medium text-paper">登录共享提示词库</p>
          <p className="mt-1 text-xs leading-5 text-muted">可使用 Google 登录，或通过邮箱一次性登录链接登录。</p>
          <button type="button" className="btn-gold mt-3 w-full justify-center" onClick={() => void signInWithGoogle()} disabled={state === 'sending'}>
            使用 Google 登录
          </button>
          <div className="my-3 flex items-center gap-2 text-[11px] text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span>或使用邮箱</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <label className="sr-only" htmlFor="supabase-login-email">邮箱</label>
          <input
            id="supabase-login-email"
            className="field mt-3"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          {message && (
            <p className={`mt-2 text-xs ${state === 'error' ? 'text-rust' : 'text-paper-dim'}`} role="status">
              {message}
            </p>
          )}
          <button type="submit" className="btn mt-3 w-full justify-center" disabled={state === 'sending'}>
            {state === 'sending' ? '发送中…' : '发送登录链接'}
          </button>
          <p className="mt-2 text-[11px] leading-4 text-muted">云端数据迁移完成前，现有本地数据不会自动上传。</p>
        </form>
      )}
    </div>
  )
}
