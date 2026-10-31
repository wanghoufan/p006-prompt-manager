'use client'

import { useMemo, useRef, useState } from 'react'
import type { Card } from '@/lib/types'
import {
  MCP_INSTALL_DIR,
  MCP_SERVER_FILE,
  buildActivationText,
  buildBundle,
  buildClientSnippets,
  buildSetupPrompt,
  buildSnapshot,
  findEntryByCode,
  type McpSnapshotEntry,
} from '@/lib/mcp/offline'
import { useModalFocus } from '@/hooks/useModalFocus'

interface McpPanelProps {
  /** 当前视图可见的卡片（示例视图传示例库，我的库传真实卡片）。 */
  cards: Card[]
  onNotify?: (msg: string) => void
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 立即 revoke 在部分浏览器会取消下载，留出窗口期再回收。
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatTime(iso: string): string {
  if (!iso) return '未知'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '未知'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * MCP 接入台。
 *
 * 2026-10-31 重做信息架构（用户反馈）：外层只留用户真正要做的两步——
 *   ① 复制一段话发给 AI（点一次即同时把接入包下载到本机，用户不用关心下载）
 *   ② 设好调取码后，对 AI 说「调取 xxx」
 * 其余（接入包体积、逐条安装动作、试调取、手工配置）全部收进折叠区。
 */
export function McpPanel({ cards, onNotify }: McpPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [codeDraft, setCodeDraft] = useState('')
  const [hit, setHit] = useState<McpSnapshotEntry | null>(null)
  const [missed, setMissed] = useState<string | null>(null)

  const entries = useMemo(() => buildSnapshot(cards), [cards])
  const generatedAt = useMemo(() => new Date().toISOString(), [])
  const bundle = useMemo(() => buildBundle(cards, generatedAt), [cards, generatedAt])
  const setupPrompt = useMemo(
    () => buildSetupPrompt({ cards, generatedAt }),
    [cards, generatedAt],
  )
  const snippets = useMemo(() => buildClientSnippets(), [])
  const empty = entries.length === 0
  const sampleCode = entries[0]?.code ?? '调取码'

  async function copyText(key: string, value: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      onNotify?.(okMessage)
    } catch {
      setCopied('error')
      onNotify?.('复制失败：请检查浏览器剪贴板权限')
    }
  }

  /**
   * 只做一件事：把「安装指令 + 完整脚本」写进剪贴板。
   * 用户不下载任何文件——文本里已含脚本全文，智能体自己落盘、写配置、自检。
   * （2026-10-31 用户两次纠正：之前拆成「下载 + 复制 + 上传」是错的。）
   */
  async function handleInstall() {
    try {
      await navigator.clipboard.writeText(setupPrompt)
      setCopied('install')
      onNotify?.(`已复制安装指令（${setupPrompt.length.toLocaleString()} 字），粘给你的智能体即可`)
    } catch {
      setCopied('error')
      onNotify?.('复制失败：请展开「看看复制了什么」手动全选复制')
    }
  }

  function handleActivate() {
    const entry = findEntryByCode(cards, codeDraft)
    if (!entry) {
      setHit(null)
      setMissed(codeDraft.trim() || '（空）')
      return
    }
    setMissed(null)
    setHit(entry)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        让 AI 直接调用你库里的卡片。装一次，之后每次只说「调取 调取码」。
      </p>

      {/* 第一步：唯一需要用户动手的事 */}
      <section className="rounded-lg border border-gold/30 bg-gold/5 px-3.5 py-3">
        <p className="text-sm text-paper">1 · 复制这段，粘给你的智能体</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          点一下<b className="text-paper-dim">只复制</b>，不用下载任何文件。这段文本里已经带着整个接入包，智能体会自己建文件、写客户端配置、跑自检。
        </p>
        <button type="button" className="btn-gold mt-2.5 w-full" onClick={() => void handleInstall()} disabled={empty}>
          {empty
            ? '先去给一张卡片设调取码'
            : copied === 'install'
              ? `已复制 ${setupPrompt.length.toLocaleString()} 字，去粘贴 ✓`
              : '复制安装指令'}
        </button>
        {copied === 'error' && (
          <p className="mt-1.5 text-xs text-rust">复制失败，请展开「看看复制了什么」手动全选复制。</p>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-muted">
            看看复制了什么（{setupPrompt.length.toLocaleString()} 字 · 内含 {bundle.entryCount} 张卡片 · {formatBytes(bundle.bytes)}）
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-ink-850 p-2 font-mono text-[10px] leading-relaxed text-paper-dim">
            {setupPrompt}
          </pre>
        </details>
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-muted">不想粘这么长？改用文件方式（可选）</summary>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            下载 {MCP_SERVER_FILE} 到本机，再让智能体把它装到 <code className="font-mono">~/{MCP_INSTALL_DIR}/</code>。
          </p>
          <button type="button" className="btn mt-1.5 w-full text-xs" onClick={() => downloadTextFile(bundle.content, bundle.fileName)} disabled={empty}>
            下载 {MCP_SERVER_FILE}（{formatBytes(bundle.bytes)}）
          </button>
        </details>
      </section>

      {/* 第二步：日常只做这一件事 */}
      <section className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
        <p className="text-sm text-paper">2 · 对 AI 说「调取 调取码」</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          在卡片上给一个短码（设置里的「调取码」字段），之后对 AI 说这句话，它就会按那张卡开工。
          {entries.length > 0 && '试试点一下复制：'}
        </p>
        {entries.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entries.slice(0, 6).map((entry) => (
              <button
                key={entry.code}
                type="button"
                className="rounded-full border border-line bg-ink-850 px-2.5 py-1 font-mono text-[11px] text-paper-dim transition-colors hover:border-gold/40 hover:text-paper"
                onClick={() => void copyText(`code-${entry.code}`, `调取 ${entry.code}`, `已复制「调取 ${entry.code}」`)}
                title={entry.title}
              >
                {copied === `code-${entry.code}` ? '已复制 ✓' : `调取 ${entry.code}`}
              </button>
            ))}
            {entries.length > 6 && <span className="self-center text-[11px] text-muted">…共 {entries.length} 个</span>}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-rust">
            库里还没有带调取码的卡片。打开一张卡片，在详情里给它设一个短码再回来；
            或者点顶栏的「示例」，把示例卡片载入自己的库（示例卡自带调取码）。
          </p>
        )}

        <details className="mt-2.5">
          <summary className="cursor-pointer text-[11px] text-muted">想在这里先试一次（不用装任何东西）</summary>
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="field min-w-0 flex-1 font-mono text-xs"
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleActivate()
                }}
                placeholder={sampleCode}
                aria-label="调取码"
                spellCheck={false}
              />
              <button type="button" className="btn shrink-0" onClick={handleActivate}>
                调取
              </button>
            </div>

            {missed && (
              <div className="mt-2 rounded-md border border-rust/40 bg-rust/10 px-2.5 py-2">
                <p className="text-xs text-rust">没有找到调取码「{missed}」对应的卡片。</p>
                {entries.length > 0 && (
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    可用：
                    {entries.slice(0, 8).map((entry) => (
                      <button
                        key={entry.code}
                        type="button"
                        className="mr-1.5 font-mono text-gold underline underline-offset-2 hover:text-paper"
                        onClick={() => {
                          setCodeDraft(entry.code)
                          setHit(entry)
                          setMissed(null)
                        }}
                      >
                        {entry.code}
                      </button>
                    ))}
                  </p>
                )}
              </div>
            )}

            {hit && (
              <div className="mt-2 rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-xs text-paper">{hit.title}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {hit.tags.length > 0 ? hit.tags.join(' / ') : '无标签'} · {hit.body.length} 字 · 更新于{' '}
                  {formatTime(hit.updatedAt)}
                </p>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-paper-dim">
                  {hit.body.slice(0, 220)}
                  {hit.body.length > 220 ? '…' : ''}
                </p>
                <button
                  type="button"
                  className="btn mt-2 w-full text-xs"
                  onClick={() => void copyText('activation', buildActivationText(hit), '已复制激活文本')}
                >
                  {copied === 'activation' ? '已复制 ✓' : '复制 AI 侧收到的原文'}
                </button>
              </div>
            )}
          </div>
        </details>

        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-muted">手动配置（不想让 AI 动手时用）</summary>
          <div className="mt-2 space-y-2">
            {snippets.map((item) => (
              <div key={item.client} className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-paper">{item.client}</p>
                  <button
                    type="button"
                    className="btn-ghost shrink-0 text-[11px]"
                    onClick={() => void copyText(`snippet-${item.format}`, item.snippet, '已复制配置片段')}
                  >
                    {copied === `snippet-${item.format}` ? '已复制' : '复制'}
                  </button>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {item.location} · {item.note}
                </p>
                <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded bg-ink-900 p-2 font-mono text-[10px] leading-relaxed text-paper-dim">
                  {item.snippet}
                </pre>
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-muted">
              命令行自检：<code className="font-mono">node &lt;脚本路径&gt; --selftest &lt;调取码&gt;</code>
              ，看到 <code className="font-mono">SELFTEST: PASS</code> 才算装好；<code className="font-mono">--list</code> 列出全部调取码。
            </p>
          </div>
        </details>
      </section>

      <p className="text-[11px] leading-relaxed text-muted">
        装好之后，AI 只要看到「调取 xxx」就去调工具，不会去文件系统里乱搜。离线包不写密钥、不发起网络请求；
        要撤销时，从客户端配置里删掉这一段、再删除 <code className="font-mono">~/{MCP_INSTALL_DIR}/</code> 即可。
      </p>
    </div>
  )
}

interface McpDialogProps {
  cards: Card[]
  onClose: () => void
  onNotify?: (msg: string) => void
}

/** 独立弹窗：汇报演示时可以直接整屏展示接入台。 */
export function McpDialog({ cards, onClose, onNotify }: McpDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(panelRef, true, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="MCP 接入台"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-ink-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="font-serif text-sm text-paper">MCP 接入台</span>
          <button type="button" className="btn-ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <McpPanel cards={cards} onNotify={onNotify} />
        </div>
      </div>
    </div>
  )
}