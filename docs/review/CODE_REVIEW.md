# 代码审查报告 · 提示词管理工具

- **审查时间**：2026-08-26（基线）｜ **2026-09-04 增补**：Supabase 云端迁移 + MCP RPC + Realtime + 写队列 30s 超时 + BUG-13 `tags.revision` 已另行经 `docs/handoff/HANDOFF.md` §16.20.1、`docs/qa/BUGS.md` 真机验收与收口材料 `L0` 门禁覆盖；本报告所列 P0/P1/P2 均为 08-26 前旧基线，已全部闭环或被新链路替代，保留作历史基线。
- **审查范围**：`src/` 全部源码（lib / app / components）+ `mcp/prompt-server/`（08-26 时点：`serverStore` + `data/store.json` + SSE 链路；09-04 后主链路为 Supabase `prompt_manager` + Realtime 7/7）
- **审查性质**：第三轮审查（备注字段 + 自动保存 + 治理规整后）+ **09-04 洁癖收尾标注**（不重做全量审查，仅明确基线时效）
- **静态检查**：2026-08-26 时 `tsc --noEmit` 通过；`npm run lint` **失败**（2 处 React Hooks 违规，08-27 已修复）｜ 2026-09-04 复核 `tsc --noEmit` 0 error、`npm run lint` 0 error（仅 scratch 2 warnings）
- **结论**：08-26 发现 **1 个 P0 阻断性 Lint 错误**、**3 个 P1**、**5 个 P2**、**3 个 P3**（均已闭环）；**09-04 后** Supabase/Realtime/MCP RPC/BUG-13 链路以 `BUGS.md` BUG-11/12/13 真机验收 + `migration list` 7/7 + 隔离恢复演练全绿为准，本报告待 Supabase 增补版。

---

## 更新记录（2026-08-26）

随「备注字段 + 失焦自动保存 + 治理规整」改造，复核以下项状态：

| 编号 | 原状态 | 现状 |
|---|---|---|
| BUG-1 | 高 · 未修 | ✅ **已修复**：初始化改为空数组 + 挂载后异步加载（`page.tsx`），不再在 `useState` 初始化器读 localStorage |
| BUG-2 | 中 · 未修 | ✅ **已修复**：`detailCard` 改用 `sourceCards.find(...)`，示例卡片可只读打开详情 |
| BUG-3 | 低/中 · 未修 | ✅ **已修复**：复制仅成功分支计数，失败提示且不计数（`handleCopy`） |
| OPT-1 | AI 请求缺 AbortController | ⏳ **未修**：`PreviewPanel`/`CardDetail`/`Composer` 均无 AbortController |
| OPT-2 | 模态框焦点陷阱 | ✅ **CardDetail 已修复**（`useModalFocus` + `role="dialog"` + `aria-modal`）；`SettingsModal` 仅有 Tab 陷阱，不完整 |
| OPT-3 | 标题可能变空串 | ✅ **已修复**：`regenMeta` 用 `data.title?.trim() \|\| card.title` 兜底 |
| OPT-4 | 模板 `{body}` 未校验 | ✅ **已修复**：`SettingsModal` 保存时校验 `{body}` 占位符 |
| OPT-5 | 弹窗打开时评分快捷键误触 | ⏳ **未修**：`page.tsx` 全局 keydown 未在 `detailId`/`showSettings` 开启时屏蔽 |
| OPT-6 | 复制失败无感知 | ✅ **已修复**：失败 `notify('复制失败，请手动复制')` |

### 新增已知边界（2026-08-26 起）

- **MCP 计数并发**：`/api/sync/increment-copy` 由 `serverStore.incrementCopy` 原子 +1，但 MCP 读 `data/store.json` 与 serverStore 内存可能短暂不一致（低并发个人场景可接受）。
- **MCP 计数失败静默**：MCP 命中后 fire-and-forget 调计数 API，失败不阻塞取卡片（`copyCount` 可能少计，可接受）。
- **跨进程写冲突规避**：MCP 不直接写 `store.json`（否则会被 serverStore 内存覆盖），统一走 API。
- **自动保存版本膨胀**：正文失焦也会生成版本快照（与手动保存一致），版本上限 10 条，长会话高频失焦可能较快占满版本列表——当前属可接受设计，如需「仅手动保存生成版本」可后续调整。

---

## 一、Bug（按严重度排序）

### BUG-NEW-1 ·【P0】Ref 在渲染阶段被赋值，违反 React Hooks 规则
- **位置**：`src/components/PreviewPanel.tsx:74`、`src/components/CardDetail.tsx:67`
- **现象**：
  ```tsx
  const draftRef = useRef(draft)
  draftRef.current = draft  // ← 在渲染阶段直接赋值
  ```
  ESLint `react-hooks/refs` 报错：`Cannot access refs during render`。这会导致 `draftRef.current` 在某些并发/批处理场景下读到陈旧值，进而使 `commitSave` 读取到过期的 `draft`，导致保存丢失或覆盖错误数据。
- **影响**：自动保存/手动保存可能读取到过期草稿，数据不一致风险。
- **建议修复**：改用 `useEffect` 同步 ref：
  ```tsx
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])
  ```
  或直接在 `commitSave` 中用 `draft`（闭包捕获最新值），无需 ref。
- **建议验证**：跑 `npm run lint` 确保 0 error；手动快速编辑多字段失焦，对比 localStorage / serverStore 最终落盘值。

---

### BUG-NEW-2 ·【P1】正文失焦即生成版本快照，版本历史极易撑满
- **位置**：`src/components/PreviewPanel.tsx:398`、`src/components/CardDetail.tsx:352`
- **现象**：
  ```tsx
  // PreviewPanel
  <textarea onBlur={() => commitSave(true)} />
  // CardDetail
  <textarea onBlur={() => commitSave(true)} />
  ```
  `commitSave(true)` → `onSaveBody` → `saveBodyWithVersion`，每次失焦都把**当前 body 作为快照**压入 `versions`（上限 10）。用户只在正文区点击/切换焦点，不做任何修改，也会生成快照（`saveBodyWithVersion` 有 `newBody === card.body` 早退，但 `commitSave` 会先比对 `draft.body !== card.body`，若用户修改后失焦，必进版本）。
- **影响**：高频编辑场景下，10 条版本上限极快耗尽，历史回滚价值大打折扣。`CURRENT_STAGE.md` 已标注为「可接受设计，如需调整后续处理」。
- **建议修复**：
  - 方案 A（最小改动）：`onBlur` 仅 `commitSave(true)`，不生成版本；`handleSave`/`Ctrl+Enter` 调用 `commitSave(false)` 时再生成版本。需把 `saveBodyWithVersion` 拆分为「仅存 body」与「存 body + 版本」两条路径。
  - 方案 B：引入「脏标记」，仅内容真正变更且失焦时才生成版本（当前 `cardDraftChanges` 已有 `bodyChanged`，可复用）。
- **建议验证**：连续 15 次「修改正文 → 点别处失焦 → 再点回来 → 修改 → 失焦」，查看版本列表是否仅保留最近 10 条且无重复空白快照。

---

### BUG-NEW-3 ·【P1】同步推送去抖未串行化，高频改动可能丢数据/乱序
- **位置**：`src/lib/storage.ts:289-296`
- **现象**：
  ```ts
  function schedulePush() {
    if (!serverMode || pushScheduled) return
    pushScheduled = true
    Promise.resolve().then(() => {
      pushScheduled = false
      void pushToServer(cacheCards, cacheSettings)
    })
  }
  ```
  `pushScheduled` 仅防重入，但 `pushToServer` 是异步的，若在上一次 `pushToServer` 尚未 resolve 前又触发 `schedulePush`，新调用会被 `pushScheduled = true` 拦截，**导致中间状态的变更丢失**，且无重试机制。
- **影响**：用户快速连续编辑多张卡片/字段，可能只有最后一次变更到达服务端，中间状态丢失；跨设备同步收到的数据不完整。
- **建议修复**：用队列串行化推送，或用 `lastPushedVersion` 对比去重（已有 `serverStore.setState` 的内容哈希去重，但客户端 `schedulePush` 缺乏同等保护）。
- **建议验证**：在 500ms 内连续修改 5 张卡片的标题/标签，观察 serverStore 版本号是否单调递增且最终状态与本地一致。

---

### BUG-NEW-4 ·【P1】全局评分快捷键在详情弹窗/设置弹窗打开时仍生效
- **位置**：`src/app/page.tsx:289-311`
- **现象**：`keydown` 监听器仅过滤 `INPUT`/`TEXTAREA`/`BUTTON`/`contentEditable`，未检查 `detailId` 或 `showSettings`。当详情弹窗打开、焦点落在「复制」按钮上时，按 `1~5` 仍会给背景选中卡片评分。
- **影响**：误操作评分，污染排序依据。
- **建议修复**：在 `onKey` 顶部加守卫：
  ```ts
  if (detailId || showSettings) return
  ```
- **建议验证**：打开详情弹窗，聚焦「复制」按钮，按 `3`，确认不触发评分、不弹 Toast。

---

## 二、潜在风险与数据一致性

### RISK-1 ·【P2】MCP 读取 `data/store.json` 可能拿到陈旧数据
- **位置**：`mcp/prompt-server/src/index.ts:40-48` `loadCards()` 直接读文件；`serverStore.ts` 持有内存单例。
- **现象**：MCP 进程独立于 Next.js 进程，读取文件时 `serverStore` 可能尚未将最新内存落盘（`writeChain` 是异步链）。CODE_REVIEW 历史已记录此边界，但未给出缓解方案。
- **影响**：MCP 调取时可能返回旧版本卡片（body/标签/调取码等）。
- **建议修复**：MCP 改为调用 `/api/sync` 获取最新数据（走 HTTP，天然读 serverStore 内存），或在 `serverStore` 暴露同步读取内存的函数供 MCP 通过 IPC/文件锁访问。
- **建议验证**：Next.js dev 运行中，MCP 调取某卡片，对比返回 body 与 UI 显示是否一致；并发修改卡片后立即 MCP 调取，观察是否有滞后。

---

### RISK-2 ·【P2】MCP 计数 fire-and-forget，失败静默导致 copyCount 少计
- **位置**：`mcp/prompt-server/src/index.ts:133-140`
- **现象**：
  ```ts
  void fetch(`${API_BASE}/api/sync/increment-copy`, { ... }).catch(() => {})
  ```
  网络错误/服务端 500/404 均被吞掉，工具仍返回成功。用户无感知，统计失真。
- **影响**：`copyCount` 统计不准，影响「按复制次数排序」与使用分析。
- **建议修复**：至少 `console.error` 记录失败；或把计数失败作为非阻断警告返回给模型（结构化内容里带 `copyCountIncremented: false`）。
- **建议验证**：停掉 Next.js dev，MCP 调取有效 code，观察工具返回是否仍成功、控制台是否有错误日志。

---

### RISK-3 ·【P2】AI 请求缺 AbortController，卸载后仍可能 setState
- **位置**：
  - `src/components/PreviewPanel.tsx:177-198` `regenMeta` / `runSummary`
  - `src/components/CardDetail.tsx:140-160` `regenMeta` / `runSummary`
  - `src/components/Composer.tsx:23-43` `generate`
- **现象**：请求发出后无 `AbortSignal` 绑定，组件卸载/切换卡片/重复点击时，旧请求返回仍会 `setDraft`/`notify`/更新状态。React 19 不再警告卸载后 setState，但属于不规范用法，可能导致 UI 闪烁、错误 toast。
- **影响**：竞态条件下 UI 状态错误、错误提示误导用户。
- **建议修复**：每个异步函数创建 `AbortController`，存入 ref，`useEffect` 清理/新请求前 `abort()`；或请求前置 `loading` 状态禁用触发按钮（`Composer` 已有 `phase` 但 `PreviewPanel`/`CardDetail` 的 `metaLoading`/`summaryLoading` 仅禁用按钮，不取消已发请求）。
- **建议验证**：快速连续点击「重新生成标签/标题」3 次，观察是否只有最后一次生效、无报错 toast。

---

### RISK-4 ·【P2】备注防抖定时器未在卸载时清理
- **位置**：`src/components/PreviewPanel.tsx:172-175`、`src/components/CardDetail.tsx:135-138`
- **现象**：
  ```ts
  notesTimer.current = window.setTimeout(() => commitSave(true), 700)
  ```
  组件卸载（切卡片/关闭弹窗）前若有待执行的 timer，会在卸载后触发 `commitSave`，此时 `card` 可能已为 `null` 或指向新卡片，导致错卡保存或报错。
- **影响**：极低概率下把备注写入错误卡片。
- **建议修复**：`useEffect` return 里 `clearTimeout(notesTimer.current)`。
- **建议验证**：打开卡片 A，修改备注，700ms 内切到卡片 B，观察卡片 A 备注是否被错误保存。

---

### RISK-5 ·【P2】调取码冲突时自动保存「静默跳过 code 字段」，用户无感知
- **位置**：`src/components/PreviewPanel.tsx:158`、`src/components/CardDetail.tsx:122`
- **现象**：
  ```ts
  if (changes.codeChanged && !codeConflict) onUpdateCode(...)
  ```
  `codeConflict` 为真时，code 字段不保存，**但其他字段正常保存**，且 `silent=true` 时完全无提示。用户以为「已自动保存」，实则调取码未落盘。
- **影响**：用户改完调取码失焦，以为保存成功，实则冲突导致未存；下次打开发现调取码丢失。
- **建议修复**：`silent=true` 时若有 `codeConflict`，至少在角标/Toast 给出冲突提示；或把 code 冲突视为「有未保存修改」，不执行静默保存，等用户手动解决冲突后再保存。
- **建议验证**：设置两张卡片同一调取码，修改其中一张的 code 失焦，观察是否有冲突提示、code 是否真正落盘。

---

## 三、优化建议

### OPT-NEW-1 ·【P3】`MAX_VERSIONS` 硬编码，不可配置
- **位置**：`src/lib/cards.ts:4`
- **建议**：迁移至 `Settings` 或常量文件，预留用户自定义入口（如 20/50/100）。

### OPT-NEW-2 ·【P3】`SettingsModal` 焦点陷阱不完整
- **位置**：`src/components/SettingsModal.tsx:18-48`
- **现象**：仅处理 `Tab` 键循环，未设 `role="dialog"`/`aria-modal`（虽已有）、未在打开时聚焦首个可聚焦元素（已有 `textarea?.focus()`）、未在关闭时归还焦点（已有 `previouslyFocused?.focus()`）。整体比 `CardDetail` 的 `useModalFocus` 弱。
- **建议**：复用 `useModalFocus` 或提取为共享 Hook。

### OPT-NEW-3 ·【P3】localStorage 配额耗尽仅 Toast 提示，无降级策略
- **位置**：`src/lib/storage.ts:58-63` `saveCards` 返回 `false` → `page.tsx:91-98` 仅 `notify('保存失败：localStorage 空间不足，可先导出备份')`
- **建议**：提供「导出备份并清空本地」一键操作，或自动清理最旧版本/最低评分卡片腾空间。

---

## 四、已确认无问题的点（本轮复核通过）

- **数据模型扩展**：`types.ts` 新增 `code`/`notes` 字段，`storage.ts` `isCard/normalizeCard` 兼容旧数据，**向后兼容性完好**。
- **导入/导出 Markdown**：`storage.ts` `parseMarkdownImport`/`buildMarkdownExport` 正确处理 `code`/`notes`/`thinkingSummary`/`versions`，往返无损。
- **回滚语义修正**：`cards.ts:45-51` `rollbackToVersion` 不再追加快照，符合「回滚是导航操作」设计。
- **调取码规范化**：`cards.ts:7-9` `normalizeCode` 统一小写+去非法字符，前后端/MCP/导入导出一致。
- **SSE 回声抑制**：`storage.ts:359-360` `lastPushedVersion` 过滤自推送回环，防止推送死循环。
- **服务端写入去重**：`serverStore.ts:48-53` 内容哈希对比，无变化不落盘不广播，避免远程回写导致的推送死循环。
- **版本快照上限**：`withVersion` 用 `[...card.versions, version].slice(-MAX_VERSIONS)` 正确限制 10 条，且全程生成新数组，不污染 `DEMO_CARDS`。
- **标签去重与截断**：`cards.ts:53-55` `parseTags` 与 `ai.ts:107-115` 均做了 `slice`/`Set` 处理，符合「1~3 个、每标签 ≤4 字」约束。
- **`extractJsonCandidates`**：能正确剥离 ```json 围栏并提取首个顶层对象/数组（`src/lib/ai.ts:55`）。

---

## 五、修复优先级建议

1. **BUG-NEW-1（P0）**：Lint 报错阻断 CI，必须先修。
2. **BUG-NEW-2（P1）**：版本历史膨胀影响核心功能可用性，建议本轮修。
3. **BUG-NEW-3（P1）**：同步丢数据风险，多人/多设备场景下严重，建议本轮修。
4. **BUG-NEW-4（P1）**：评分误触体验差，修复成本极低，建议本轮修。
5. **RISK-3（P2）**：AI 请求无 AbortController，属规范性缺陷，建议下轮统一接入。
6. **RISK-4（P2）**：定时器泄漏，修复成本低，建议下轮修。
7. **RISK-5（P2）**：冲突静默，易引发用户困惑，建议下轮改进提示。
8. **RISK-1/2（P2）**：MCP 数据一致性/计数可靠性，属架构层面，建议单独排期重构（如 MCP 改走 HTTP 读取）。
9. **OPT-NEW 系列（P3）**：非阻断，排入 `PRODUCT_BACKLOG.md` 待后续迭代。

---

> **本轮结论**：**存在 1 个 P0 阻断性 Lint 错误（Ref 渲染期赋值），须修复后方可交付**。其余 P1 为功能体验缺陷，建议同步修复；P2/P3 可按优先级排期。

(End of file)