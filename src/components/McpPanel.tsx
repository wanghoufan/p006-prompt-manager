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

export function McpPanel({ cards, onNotify }: McpPanelProps) {
  const [codeDraft, setCodeDraft] = useState('')
  const [hit, setHit] = useState<McpSnapshotEntry | null>(null)
  const [missed, setMissed] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const entries = useMemo(() => buildSnapshot(cards), [cards])
  const generatedAt = useMemo(() => new Date().toISOString(), [])
  const bundle = useMemo(() => buildBundle(cards, generatedAt), [cards, generatedAt])
  const setupPrompt = useMemo(
    () => buildSetupPrompt({ entryCount: entries.length, sampleCode: entries[0]?.code ?? null, generatedAt }),
    [entries, generatedAt],
  )
  const snippets = useMemo(() => buildClientSnippets(), [])

  async function copy(key: string, value: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      onNotify?.(okMessage)
    } catch {
      setCopied('error')
      onNotify?.('复制失败：请检查浏览器剪贴板权限')
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

  function handleDownload() {
    downloadTextFile(bundle.content, bundle.fileName)
    onNotify?.(`已下载 ${bundle.fileName}（${bundle.entryCount} 张卡片）`)
  }

  const empty = entries.length === 0

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gold/25 bg-gold/5 px-3.5 py-3">
        <p className="text-sm text-paper">MCP 接入台</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          把当前提示词库变成一个离线 MCP 工具，装到你或别人自己的电脑上；也可以在这里先直接用调取码试一次。
          生成的包<b className="text-paper-dim">只含带调取码的卡片快照</b>，不含 API Key，也不联网。
        </p>
      </div>

      {/* 1｜调取码试用：不需要任何客户端就能看到 MCP 命中的结果 */}
      <section className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
        <p className="text-sm text-paper">第一步 · 试调取码</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          输入卡片上设的调取码，看看 AI 侧拿到的是什么（大小写不敏感）。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            className="field min-w-0 flex-1 font-mono text-xs"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleActivate()
            }}
            placeholder={entries[0]?.code ?? '例如 code-review'}
            aria-label="调取码"
            spellCheck={false}
          />
          <button type="button" className="btn-gold shrink-0" onClick={handleActivate}>
            调取
          </button>
        </div>

        {empty && (
          <p className="mt-2 text-xs leading-relaxed text-rust">
            当前库里还没有<b>带调取码</b>的卡片。先在卡片详情里给一张卡设置调取码，再回来这里体验。
          </p>
        )}

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
                {entries.length > 8 && <span>…等 {entries.length} 个</span>}
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
              onClick={() => void copy('activation', buildActivationText(hit), '已复制激活文本，可直接贴给 AI')}
            >
              {copied === 'activation' ? '已复制 ✓' : '复制这段激活文本（AI 侧收到的原文）'}
            </button>
          </div>
        )}
      </section>

      {/* 2｜生成离线接入包：一个文件，扔到别人电脑上就能用 */}
      <section className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
        <p className="text-sm text-paper">第二步 · 下载离线接入包</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          生成一个零依赖的 <code className="font-mono text-[11px]">{MCP_SERVER_FILE}</code>：
          数据已内嵌，不需要服务端、不需要 npm install、不需要 Node 之外的任何东西（Node 18+）。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="rounded-full border border-line bg-ink-850 px-2 py-0.5">
            {bundle.entryCount} 张可调取
          </span>
          <span className="rounded-full border border-line bg-ink-850 px-2 py-0.5">{formatBytes(bundle.bytes)}</span>
          <span className="rounded-full border border-line bg-ink-850 px-2 py-0.5">stdio · 单文件</span>
        </div>
        <button type="button" className="btn-gold mt-2 w-full" onClick={handleDownload} disabled={empty}>
          {empty ? '先给卡片设调取码再下载' : `下载 ${MCP_SERVER_FILE}`}
        </button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          下载后文件通常在「下载」目录。这是一个快照：以后在网页里改了卡片，重新下载同名文件覆盖即可，客户端不用重配。
        </p>
      </section>

      {/* 3｜给 AI 的一句话：让 AI 自己装好并自检 */}
      <section className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
        <p className="text-sm text-paper">第三步 · 把这句话发给你的 AI</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          它会找到刚下载的文件、装到 <code className="font-mono text-[11px]">~/{MCP_INSTALL_DIR}/</code>、
          写进你本机的 MCP 客户端配置，并跑一遍自检。你只需要把文件下载好，然后粘贴这段话。
        </p>
        <button
          type="button"
          className="btn-gold mt-2 w-full"
          onClick={() => void copy('prompt', setupPrompt, '已复制，去粘贴给你的 AI')}
          disabled={empty}
        >
          {copied === 'prompt' ? '已复制，去粘贴给你的 AI ✓' : '复制接入提示词'}
        </button>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted">先看看这段提示词写了什么</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-ink-850 p-2 font-mono text-[10px] leading-relaxed text-paper-dim">
            {setupPrompt}
          </pre>
        </details>
      </section>

      {/* 4｜手工配置：给不想让 AI 动手的人，也给排查用 */}
      <details className="rounded-lg border border-line bg-ink-900 px-3.5 py-3">
        <summary className="cursor-pointer text-sm text-paper">想自己配？客户端配置片段</summary>
        <div className="mt-2 space-y-2">
          {snippets.map((item) => (
            <div key={item.client} className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-paper">{item.client}</p>
                <button
                  type="button"
                  className="btn-ghost shrink-0 text-[11px]"
                  onClick={() => void copy(`snippet-${item.format}`, item.snippet, '已复制配置片段')}
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
            ，看到 <code className="font-mono">SELFTEST: PASS</code> 才算装好；<code className="font-mono">--list</code> 可列出全部调取码。
          </p>
        </div>
      </details>

      <p className="text-[11px] leading-relaxed text-muted">
        接好之后，对自己的 AI 说「调取 {entries[0]?.code ?? '调取码'}」即可加载对应卡片。
        离线包不写任何密钥、不发起网络请求；要撤销时，从客户端配置里删掉这一段、再删除{' '}
        <code className="font-mono">~/{MCP_INSTALL_DIR}/</code> 即可。
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