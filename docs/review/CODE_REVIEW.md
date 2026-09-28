# 代码审查报告 · 提示词管理工具

- **审查时间**：2026-08-26（基线）｜ **2026-09-04 增补**：Supabase 云端迁移 + MCP RPC + Realtime + 写队列 30s 超时 + BUG-13 `tags.revision` 已另行经 `docs/handoff/HANDOFF.md` §16.20.1、`docs/qa/BUGS.md` 真机验收与收口材料 `L0` 门禁覆盖；本报告所列 P0/P1/P2 均为 08-26 前旧基线，已全部闭环或被新链路替代，保留作历史基线。｜ **2026-09-28 增补**：SQLite 本地存储迁移专项审查（commit `1ba17df`，见文末「四、SQLite 本地存储迁移专项审查（2026-09-28）」）
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

---

## 六、PreviewPanel 拖宽下限修复复核（2026-09-17，code-reviewer；已提交 `7f0c9ed`）

- **复核范围**：`src/components/PreviewPanel.tsx`（`MIN_W 0→280` + `readSavedWidth` 旧值自愈回写）；复核时为未提交 diff，同日已提交为 `7f0c9ed`（工作区 `src/` 现为干净）。只读代码与 diff，未改业务代码。
- **静态检查**：`npx tsc --noEmit` 0 error；`npm run lint` 0 error（仅 scratch 2 warnings，与本轮无关）。
- **结论**：**PASS**（可合入；下限 280 合理，自愈逻辑无阻断性漏洞；以下均为 P2/P3 备注，不阻塞）。

### 通过项

- 下限 280 合理：默认 `defaultWidth=320`（注：任务描述称默认 420，实测代码 77 行为 320；280<320<720 无论按哪个默认值都成立），上限 720 不变；280 保证正文/标题/备注可编辑区可用，同时根除“0 宽后面板内 2px 拖拽手柄与双击区不可达”的死结。注释（43–44 行）把原因写清。
- `clampWidth`（48–50 行）与 `handleDragMove`（220–230 行）一致：拖拽经 `clampWidth` 后 `setWidth` + 持久化已钳制值，拖不到 0。
- 自愈逻辑（52–67 行）覆盖全部脏旧值：`0` / `<MIN_W` / `>MAX_W` / `NaN` / `Infinity` / `''`（`Number('')=0` 落入自愈分支）一律回退 clamped `fallback` 并回写 `localStorage`，旧 0 值不会反复压扁面板；`try/catch` 保留，隐私模式等异常路径仍回退可用宽度。

### 问题列表（均不阻塞，仅备注）

- 【P2】`resetWidth`（250–258 行）写回的是原始 `defaultWidth` 而非钳制值：当前调用方默认 320 在界内无影响；若将来有调用方传入越界 `defaultWidth`，state 与存储将违背钳制契约。建议 `setWidth(clampWidth(defaultWidth))` + 存钳制值（改动一行，builder 顺手修即可）。
- 【P3】`raw === null` 首访路径（57 行）返回原始 `defaultWidth`，而脏值路径返回 clamped `fallback`，两者不一致（同一切入点：越界 defaultWidth 才分叉，当前无影响）。可统一为 `fallback`。
- 【P3】自愈回写发生在 `useState` 初始化器（render 阶段副作用）：幂等写入，StrictMode 双调用无害，功能正确；仅从纯度角度备注，不要求改。
- 【备注不动】`TagPanel.tsx:60/67–76` 同类问题仍在：`PANEL_MIN_W=0` + `Number(null)=0` 恰好通过 `>=0` 校验（首访即可能读到 0 宽）且无自愈回写。若左面板同样存在“0 宽抓不回”死结，建议另起一单对齐（下限>0 或照抄本轮自愈模式）；本轮只备注，不动。

---

## 七、P0 标签删除复活修复复核（2026-09-17，code-reviewer；工作区未提交）

- **复核范围**：`src/app/page.tsx`（基线逐实体推进、tombstone 全链路 `pm:pending-tag-deletes`、Realtime 门禁补 tag 脏标记、`restoreTagSnapshot` 补脏标记）、`src/lib/tagTombstones.ts`（新增）、`src/lib/supabase/promptRepository.ts`（`deletePromptTag` 0 行回读复核）。只读代码与 diff，未改业务代码。树上另有旧改动（诊断横幅已回退、`TagPanel.tsx` 下限 280）在列，不属本轮复核对象，仅备注一致性。
- **静态检查**：`npx tsc --noEmit` 0 error；`npm run lint` 0 error（仅 scratch 2 warnings，与本轮无关）。
- **结论**：**PASS**（可合入；以下 P2/P3 不阻塞，但建议 builder 顺手修 P2-1）。

### 通过项

- **tombstone 不会永久隐藏正常标签**：清除路径齐全——云端删除确认成功逐实体 `clearTagDeletes`（`page.tsx` 删除循环内）、撤销整体回退 `restoreTagSnapshot` 清快照全部标签 id、回收站恢复清 `restoringIds`；崩溃残留可自愈（下轮写 effect 由“基线有、本机无”重新发起真删，`deletePromptTag` 0 行复核判成功后清除）。id 为 uuid 不复用，无“旧 tombstone 误杀新同名标签”问题。
- **基线语义自洽**：基线刻意取未过滤 `next.tags`（云端真实行），tombstone 只过滤视图；待删标签因此仍留在基线里，下一轮由“基线有、本机无”自然发起真删除。保存循环逐实体推进基线（成功即 `set` 该 id），整轮失败不再回滚已确认部分，注释与代码一致。
- **0 行复核无“RLS 拒绝误判成功”风险**：`delete` 0 行 → `select … maybeSingle()` 复核。行仍可见（确属本用户但删不掉）→ 按失败上报重试；行不可见（已删 / 非本用户 RLS select 同样看不到）→ 按成功处理——后者云端不可能再回填给本机（select 看不见 = Realtime/快照也看不见），判成功正确且避免无意义重试死循环。`recheckError` 按失败上报，`id` 为主键 `maybeSingle` 合法。
- **Realtime 门禁**：`refresh` 等待条件补 `hasPendingTagCloudWrite()`，标签写队列未清空前不拉快照，避免半完成快照覆盖本地删除。
- **`mergeTags`（合并）计入删除**：`markTagsDeleted([sourceId])` 在快照之后、校验冲突之后，顺序正确；撤销经 `restoreTagSnapshot` 清除对应 tombstone。
- **诊断横幅已干净回退**：`syncDiag` state 与渲染横幅、`setSyncDiag` 调用已全量移除，无残留。

### 问题列表（均不阻塞）

- 【P2-1】陈旧 tombstone 会污染 legacy（未登录）派生兜底：`markTagsDeleted` 仅云端模式记录，但 `activeTagData` 派生兜底过滤（`page.tsx:800` 起）与 `mergeLocalOnlyIntoRemoteSnapshot` 的 `deadTagIds` 参数不分云端/legacy。若用户云端删标签后登出，残留 tombstone（删除尚未确认成功时）在 legacy 视图下仍剔除同 id 派生标签。建议过滤时加 `cloudMode` 守卫，或登出/切换 legacy 时清空 tombstone（`clearTagDeletes(deadTagIds())` 或直接 `writePendingTagDeletes(new Set())`）。
- 【P3-1】`writePendingTagDeletes` 配额满时静默丢弃：后果是复活（删除意图丢失），不是隐藏，方向安全；仅备注。若要更稳，可在丢弃时 `notify` 一句“本机待删标记保存失败”。
- 【P3-2】`clearTagDeletes` 清的是快照**全部**标签 id（`restoreTagSnapshot`），而非仅被删 id：语义是“凡在快照里出现即视为已还原”，当前撤销即整体回退快照，正确；仅备注，若将来改为增量撤销需收窄。
- 【备注不动】`TagPanel.tsx` 本轮 diff（`PANEL_MIN_W 0→280` + 旧值自愈回写）与 §六 PreviewPanel 修复同模式、下限 280 与上限 480 自洽，不属本轮 P0 范围，仅确认无冲突，不另开问题。

(End of file)
## 2026-09-17 Code Review：withTagWriteLock / savePromptTag / deletePromptTag（同id串行链）

- 范围：src/lib/supabase/promptRepository.ts L309-L406（withTagWriteLock、savePromptTag经由revisionedSave、deletePromptTag重试复核）。结论：PASS。
- 同id串行/死锁：`previous.then(task, task)` 使前任reject仍放行后任；`tail=run.then(()=>{},()=>{})` 恒resolve，链尾永不卡死；`return run` 把原始resolve/reject原样交还调用方，无吞错。key按tagId隔离，不存在跨id串错；同id的建/删/改按调用先后排队，与注释“删持有整删过程锁、排在先建之后”一致。
- 异常路径放行链尾：已覆盖（rejection双分支+tail吞错）。run若调用方不await会有unhandledRejection风险，但save/delete均return run由调用方处理，本文件内无漏。
- 3次重试语义：`DELETE_TAG_ATTEMPTS=3` + `attempt<ATTEMPTS`才delay，总附加延迟≤2×150ms，与注释一致；FK/RLS delete error与recheck error均立即failure不重试，正确；仅“recheck仍可见”时重试，终态仍可见才报错并带8位tagId，正确。
- RLS不可见按成功：recheck miss→ok:true。单用户owner模型下可接受（否则delete 0行+recheck不可见会重试死循环）；代价是跨用户/策略误配的真失败会被当成功掩盖，建议仅记为已知权衡，不判FAIL。
- Map链尾回收：`tail.then(()=>{get===tail才delete})` 防止后写被先链尾误删；tail恒settled故无永久残留，标签量级下无泄漏。极端：进程崩溃/页面卸载时内存Map随堆消失，无需持久化。
- 未发现P0/P1问题，不建议改动。
## 2026-09-17 Code Review：sameInstant/tagsSemanticallyEqual + tombstone补传四处

- 范围：`src/app/page.tsx:114-136` 定义、`743` 调用处；tombstone 过滤 `mergeLocalOnlyIntoRemoteSnapshot(65-95)` 及调用处 `419/567`、缓存回退 `498-503`、离线兜底 `530-536`、Realtime 订阅 `583-588`、派生兜底 `832-841`。结论：PASS。
- 漏字段：`Tag` 共 8 字段（`src/lib/types.ts:54-67`），`tagsSemanticallyEqual` 逐字段全覆盖（id/name/parent_id/icon/is_pinned/sort_order/created_at/updated_at，时间戳经 `sameInstant` 归一化），无真改动被吞；调用处 `743` 命中即 `continue` 跳过 upsert，仅省掉纯格式差异（+00:00 vs Z）空转。
- `Date.parse` 非法值：`a===b` 先短路（同串非法值判等，不空转）；异串但任一 NaN 时返回 false → 走向 upsert（多写一次，安全方向），不吞真改动。
- tombstone 误伤：四处（快照合并双侧/缓存/离线/订阅）+派生兜底均按 `dead.has(tag.id / relation.tag_id)` 精确过滤，不碰正常标签；基线刻意取未过滤 `next.tags`（`427/431`），删除仍能经「基线有、本机无」+`deadTagIds` 补传（`795-797`）发起，确认成功后清 tombstone（`806-807`）及恢复清（`1067/1352`）闭环，无永久隐藏。
## 2026-09-17 Code Review：deleteTagsInCloud 及两处调用（单删/批量）

- 范围：`src/app/page.tsx:1513-1542` 定义、`1573` 单删调用、`1629` 批量调用。结论：PASS。
- await阻塞：两调用处均先 `applyTags` 乐观更新 UI 再 `await deleteTagsInCloud`；await 期间让出主线程只做网络等待，不阻塞渲染，无 UI 卡死。
- 失败不回滚自洽：本机已删不回滚 + 失败保留 tombstone（`markTagsDeleted` 先落盘）+ 吐司 + `retryCloudSync()`，与写 effect 删除段（`791-808`：基线有本机无 ∪ tombstone 补传、成功才 `delete` 基线 + `clearTagDeletes`）闭环；回填快照取未过滤基线（`431-432`）保证删项不复活。
- 深→浅顺序：`depthOf` 沿 `parent_id` 链计深（含环 guard）、`sort(b-a)` 子先父后，避免父先删触发 FK 拒绝；单删 subtree 传删前 `tags` 快照计深正确，批量仅删最高层同样安全。
- cloudMode守卫：函数入口 `!cloudMode return`，与 `mark/clearTagDeletes` 非云端 no-op（`308`）及 effect 守卫（`728`）一致；离线删除意图仍有本机 tombstone，待上线后补传。
- 小注（不判FAIL）：失败仅保留最后一条 message，多 id 部分失败时提示收敛为一条，tombstone 仍逐 id 保留由 effect 逐个重试，无丢失。
## 2026-09-17 Code Review：TagPanel 批量行点击/筛选分支与事件隔离

- 范围：`src/components/TagPanel.tsx:227-319`。结论：FAIL（P1：批量下仅中间名称按钮切选中，行空白区无响应，不符合“行点击切选中”）。
- 分支正确：名称按钮 `selectable ? onToggleSelect : onSelectTag (289)`，批量切选中、非批量仍筛选，逻辑对。
- 事件隔离正确：checkbox `onChange` 切选中 + `onClick stopPropagation (258-259)` 无双重触发；箭头 `stopPropagation + onToggle (269-272)`；菜单 `stopPropagation + setMenuOpen (308-311)`，三处均未误触吞事件。
 - FAIL 点：行容器为普通 `div (228-229)` 无 `onClick`，`selectable` 下点击行左右 padding/checkbox 间隙无反应；修复：在行容器加 `onClick selectable→onToggleSelect`（并给箭头/checkbox/菜单保持 stopPropagation），或把名称按钮拉伸覆盖整行。
## 2026-09-17 Code Review：TreeNode 整行切换返修复核

- 范围：`src/components/TagPanel.tsx:231-233` 行容器 onClick、`292-297` 名称按钮分支、`264/275/317` 三处 stopPropagation。结论：PASS。
 - 整行切换：行容器 `onClick selectable→onToggleSelect`，批量下整行可点；非批量无操作，筛选仍走名称按钮。
 - 单次触发：名称按钮 `if (!selectable) onSelectTag`，批量下由整行统一处理，无冒泡双切。
 - 事件隔离：checkbox(264)/展开箭头(275)/更多菜单(317)三处 `stopPropagation` 完好，不误触行切换。

---

# CODE REVIEW

- Task: P0-C DeepSeek 模型改名 + 模型手填（Requirement=`docs/review/PRODUCT_BACKLOG.md` P0-C 节）
- Commit: 未提交（工作区 diff，`src/lib/ai/types.ts` + `SettingsModal.tsx` + `storage.ts` + `promptRepository.ts` + `deepseek.ts` + `page.tsx`）
- Reviewer: code-reviewer（2026-09-20，只读复核，未改业务代码）
- Result: 过（PASS；无 P0/P1；P2/P3 备注各 1，不阻塞合入）
- 静态检查：`npx tsc --noEmit` 0 error；`npm run lint` 0 error（仅 scratch 2 warnings，与本轮无关）

## P0 / P1 Findings

- 无。逐项核对结论如下：
- 迁移范围正确：`LEGACY_DEEPSEEK_MODEL_MAP` 只在 `normalizeAiModel` 内 `provider === 'deepseek'` 时生效（`types.ts:31`）；`opencode-go` 预置仍保留 `deepseek-v4-flash`（`types.ts:15`）且走 `raw` 原样分支，不被误迁移。`storage.ts:124` 与 `promptRepository.ts:127` 均把 provider 透传给 `normalizeAiModel`，通道区分正确。
- 手填透传：`SettingsModal` 下拉已改为 `input + datalist`（`:364-376`），任意字符串可输入保存（`onChange saveAi({aiModel: e.target.value})`）；`normalizeAiModel` 非空即透传、无白名单（`:32`）；服务端 `resolveAIConfig`（`src/lib/ai.ts:60-65`）同样无白名单直传。旧 openrouter `auto/custom` 双控件分支已删除，无残留。
- 三处同源：`AI_PROVIDERS`（`types.ts:6`，4 项）＝ `AI_SERVICES` 4 项（`SettingsModal.tsx:43-73`，models 全部改为引用 `AI_MODEL_PRESETS`，无硬编码分叉）＝ `factory.ts` switch 4 分支（`:8-15`）。注释“改三处”契约（`types.ts:5`）依然成立。
- 默认值常量：`DEFAULT_AI_PROVIDER/MODEL`（`types.ts:18-19`）已用于 `page.tsx:161-162`、`storage.ts:105-106/123-124`、`deepseek.ts:4`；空模型回退取本服务商首个预置（再不济全局默认），`storage` 与 `promptRepository` 归一化一致。

## P2 / P3 Backlog Findings

- 【P2】服务端直读旁路迁移：`resolveAIConfig`（`src/lib/ai.ts`）读 `serverStore` 原始值，不调 `normalizeAiModel`；deepseek 通道旧名 `deepseek-v4-flash` 在客户端下次 `normalizeSettings` 落盘前仍以旧名发往官方（官方称仅兼容期）。建议在 `resolveAIConfig` 返回前对 `model` 加一行 `normalizeAiModel(provider, model)`（纯透传语义不变，仅补迁移），builder 顺手修。
- 【P3】`deepseek-flash` 是否为官方现行有效模型名无法从本仓库验证（预置即产品断言，P0-C 称来自 2026-09-17 定价页；手填透传已保证即便名不准用户仍可自填，不阻塞）。

---

# 四、SQLite 本地存储迁移专项审查（2026-09-28）

- **审查对象**：commit `1ba17df`「SQLite 本地存储迁移：从 Supabase 云端切到本地 SQLite 作为唯一主存储」（19 文件，+1329/-282），及其与既有双模式（Supabase 云端 / 局域网同步）代码的交互。
- **审查方法**：全量通读迁移涉及文件（`src/lib/db/sqlite.ts`、`db/migrations/0001_init.sql`、`src/lib/serverStore.ts`、`src/lib/storage.ts`、`/api/sync`、`/api/sync/stream`、`/api/sync/increment-copy`、`/api/mcp/activate`、`/api/mcp-access-tokens`、`src/lib/supabase/mcpTokens.ts`、`mcp/prompt-server/src/index.ts`、`scripts/import-export-sqlite.mjs`、`scripts/backup-sqlite.sh`、`Dockerfile`、`compose.yaml`、`docker/env.template`、`McpCloudAccess.tsx`、`SupabaseAuthControl.tsx`、`page.tsx` 双模式判定）+ Grep 排查 Supabase 残留引用。
- **静态验证**：`npx tsc --noEmit` 0 error；`npm run lint` 0 error（9 warnings，集中在 `scratch/` 与治理脚本，迁移代码仅 1 条 `Unused eslint-disable`，见 P2-4）；`npm run build` 成功（11 routes，standalone 产物正常）。**未做真机运行验证**（迁移完成时间早于本次审查，生产容器状态未知，避免审查动作干扰运行数据）。
- **结论**：**无 P0 阻断项**。迁移核心链路（建库/Migration、快照读写、SSE、MCP 令牌与激活、双模式降级、部署配套、.gitignore）实现正确且自洽；发现 **3 个 P1**（运维脚本与安全模型）、**5 个 P2**、**3 个 P3**。

## 4.1 迁移正确性确认（已验证通过的点）

1. **Schema 约束完整自洽**（[0001_init.sql](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/db/migrations/0001_init.sql)）：cards CHECK（title 非空 / rating 0-5 / code 小写字母数字连字符）+ partial unique index（`code IS NOT NULL`）、tags 同父重名唯一（`COALESCE(parent_id,'')`）、card_versions / prompt_tags `ON DELETE CASCADE`、tags 自引用 `ON DELETE RESTRICT`。`setState` 全量覆写的删除顺序（先删关系与版本 → `UPDATE tags SET parent_id = NULL` → 再删 tags）正确绕开了自引用 RESTRICT。
2. **Migration 机制可靠**（[sqlite.ts](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/src/lib/db/sqlite.ts)）：版本表 + 事务内执行 + 失败回滚；`db/migrations` 打进 Docker 镜像（`COPY --from=builder /app/db ./db`）；PRAGMA（WAL / foreign_keys / busy_timeout）在连接时统一施加；`VACUUM INTO` 在线热备。
3. **密钥不落库双向闭环**：服务端 `sanitizeSettings` 剥离 `aiApiKey`（写入前 + GET 快照双保险），settings 表无该列；客户端 `loadFromServer` 取回后从本机 localStorage 补回 Key；`settingsForServer` 推送前再剥一次。
4. **MCP 链路完整**：令牌仅存 SHA-256 哈希（64 位 CHECK）、明文一次性返回、`revoked_at IS NULL` 过滤；`/api/mcp/activate` 校验→`activatePromptByCode` 原子 +1（copy_count/revision/updated_at）→EventEmitter 广播→SSE→前端实时刷新；`prompt-server` 走 HTTP 后不再依赖 `node:sqlite`（engines >=18 仍成立）。
5. **运行时验证接口齐全**：`checkIntegrity()`（integrity_check + foreign_key_check + schema 版本）与导入脚本尾部的核对输出，为运维提供了健康检查抓手。
6. **.gitignore 正确屏蔽** `/data/`、`*.db`、`*.db-wal`、`*.db-shm`，真实库不会进 Git。
7. **双模式保留是刻意设计而非迁移遗漏**：Supabase env 留空时 `getSupabasePublicConfig()` 返回 null → `getPromptCloudSessionUser()` 返回 `signedIn:false` → page.tsx 自动走 `/api/sync` 本地链路；`SupabaseAuthControl` 在未配置时 `return null` 不渲染。旧 Supabase 代码是可选回退路径，非死代码（是否清理见 §4.3 决策点）。
8. **并发安全（单进程内）**：`getDb()` 同步初始化；`setState`/`incrementCopy`/`activatePromptByCode` 从读快照到 COMMIT 全程同步无 `await`，JS 单线程下不会出现读到一半被其他请求交叉的版本竞态；`BEGIN IMMEDIATE` 保证对 SQLite 的写锁。

## 4.2 发现的问题

### P1（应修 / 需拍板）

- **P1-1 · 备份恢复脚本可在运行中的库上直接覆盖，存在数据损坏风险**
  位置：[backup-sqlite.sh](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/scripts/backup-sqlite.sh#L60-L89)
  `restore` 分支直接 `cp "$backup_file" "$db"` 并删除 `-wal/-shm`。若容器正在运行：① 运行进程仍持有旧文件句柄与 WAL，恢复后新写可能进已被删除的 WAL，或与新库内容交叉，造成数据错乱；② 恢复前的自动安全备份只 `cp` 主 .db 文件，**不含 -wal 中尚未 checkpoint 的数据**，该"安全备份"可能不完整。
  建议：脚本开头检测容器运行状态（或至少输出醒目提示）要求先 `docker compose stop`；pre-restore 备份改用 `sqlite3 "$db" "VACUUM INTO ..."` 替代 `cp`。

- **P1-2 · 导入脚本与运行中服务并发会打乱版本号状态**
  位置：[import-export-sqlite.mjs](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/scripts/import-export-sqlite.mjs#L340)（`meta.version` 重置为 1）+ 全量覆写。
  若在应用运行时执行导入：库内 version 回退到 1，而已连接客户端 `knownVersion` 处于高位 → SSE 永远判"不更新"（`version <= knownVersion` 跳过）、POST `baseVersion` 恒冲突；WAL 模式下双进程并发写还可能触发 busy 超时。脚本注释只提示"执行前建议先备份"，未提示"先停服务"。
  建议：脚本头部加醒目前置条件说明（先 `docker compose stop`）；有条件时检测 3100 端口占用即拒绝执行。此为一次性脚本，风险窗口小，但一旦踩中排查成本高。

- **P1-3 · 局域网安全模型相对 Supabase 明确弱化，需用户知情拍板**
  位置：[sync/route.ts](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/src/app/api/sync/route.ts#L21-L40)（`baseVersion` 缺省时**完全不做版本校验**，局域网内任意设备可整体覆写/清空库）、[mcp-access-tokens/route.ts](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/src/app/api/mcp-access-tokens/route.ts)（GET/POST 管理 API 无任何认证）。
  旧链路有 Supabase RLS + 记录级 revision 保护；本地模式退化为纯局域网信任（代码注释已自述"局域网信任模型"）。家用单网段场景通常可接受，但服务绑定 `0.0.0.0:3100`，同网段任意设备可写。**这不是迁移引入的 bug，而是架构决策**：请用户确认接受，或选择轻量加固（如 `/api/sync` 写操作强制要求 baseVersion、或给管理端点加简单令牌）。

### P2（一般问题）

- **P2-1 · 全量覆写 + 全量序列化 diff 的性能模型**（[serverStore.ts](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/src/lib/serverStore.ts#L178-L211)）：每次 `setState` 先把当前库全读出、两次 `JSON.stringify` 全量比较、再 DELETE 全表 + 全量 INSERT。当前 73 卡规模无感；卡片/版本数增长到千级后，每次小改动（如复制计数走的是独立轻量路径不受影响，但任意正文/设置保存）都会全库重写。属旧 JSON 存储模式的直迁遗留。建议：数据量显著增长前保持现状；后续可演进为按实体增量 upsert（接口协议不变）。
- **P2-2 · `revision` 字段语义残留**：`cards.revision`、`settings.revision` 在 schema 中保留，但普通写入恒为 1（只有 MCP activate 才对单卡 +1），前端真正的乐观并发控制是 `meta.version`（knownVersion/baseVersion）。若不打算恢复记录级条件更新，建议在后续 migration 中去掉这两列或在 [0001_init.sql](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/db/migrations/0001_init.sql) 头注注明"仅 MCP 链路使用，非并发控制依据"，避免后来者误读。
- **P2-3 · 空 title 可穿透前端校验并导致整批写入失败**：`isCard` 只验 `isString(x.title)`，空字符串可通过；服务端 INSERT 触发 `CHECK(length(trim(title))>0)` 失败 → **整个 setState 事务回滚** → 客户端 `serverMode=false` 静默降级本机缓存，每次重试都失败。UI 正常操作不会产生空 title，但导入/异常输入路径可能触发，且失败表现（同步静默失效）难以自查。建议：`isCard` 增加 `x.title.trim()` 非空，或 `setState` 写入前对非法卡片整体拒绝并返回明确错误。
- **P2-4 · 死代码与版本号不一致（清理项，可打包一次处理）**：① [import-export-sqlite.mjs:199-208](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/scripts/import-export-sqlite.mjs#L199-L208) `const taggedCards = 0` + `void taggedCards` + 失效的 eslint-disable（lint 警告来源）；② 同脚本 [末尾](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/scripts/import-export-sqlite.mjs#L371) `existsSync(options.input)` 在 `readFileSync` 之后恒为 false，属死检查；③ [mcpTokens.ts](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/src/lib/supabase/mcpTokens.ts) 已是纯本地 API 客户端，仍留在 `src/lib/supabase/` 目录（命名误导，若保留 Supabase 回退路径则至少加注说明）；④ `mcp/prompt-server/package.json` version `0.1.0` 与 `index.ts` McpServer version `0.2.0` 不一致。
- **P2-5 · 交接与档案缺口（治理项）**：`docs/handoff/HANDOFF.md` 无本次迁移的交接记录；AGENTS.md「项目档案/技术栈」仍写"共享存储：Supabase … 为主"，与"SQLite 唯一主存储"的新事实冲突（按全局工作原则 9 应修正文档）。迁移的运维约定（备份命令、恢复前提、导入前提）也无处落档。

### P3（建议）

- **P3-1 · WAL 例行维护缺失**：长跑容器 WAL 文件会缓慢增长（默认 auto-checkpoint 1000 页可缓解但主库 -wal 常驻）；可在 `backup-sqlite.sh` 的 backup 分支顺手执行 `PRAGMA wal_checkpoint(TRUNCATE)`。
- **P3-2 · compose 无 healthcheck**：`deploy.sh` 已有 HTTP 验证兜底，可选为容器加 `healthcheck`（GET /api/sync 200 即健康），便于 `restart: unless-stopped` 之外的异常感知。
- **P3-3 · 长期演进**：若未来恢复多端使用，P2-1 的增量写 + P1-3 的鉴权是两个前置改造项；单机场景无需启动。

## 4.3 交由用户决策的事项（2026-09-28 用户已裁定）

1. **Supabase 回退路径去留**：保留（现状，env 留空即本地模式，代码含双模式约千行）vs 彻底拆除（删 `src/lib/supabase/{browser,server,config,promptRepository}.ts`、`SupabaseAuthControl.tsx`、`@supabase/*` 依赖及 page.tsx 云端分支，显著瘦身）。彻底拆除后若再要云端需重新实现；保留则需接受双模式维护成本。→ **【已裁定】保留双模式。**
2. **P1-3 局域网信任模型**：接受现状（家用单网段）或做轻量加固（写操作强制 baseVersion / 管理 API 加令牌）。→ **【已裁定】接受现状，不加鉴权。**
3. **P2-5 文档补齐**：是否授权将 AGENTS.md 技术栈描述、HANDOFF 交接记录按新事实更新（涉及修改 AGENTS.md，按规矩需用户点头）。→ 待办。

## 4.4 复审记录：卡片重复修复（2026-09-28 第二轮）

- **复审对象**：commit `b1bf1af`「修复：本地模式下用服务器数据覆盖 localStorage，避免旧 UUID 残留导致卡片重复（240=120×2）」，改动仅 [page.tsx](file:///Users/zzymima0000/Developer/coding/1.Active/006-ing-提示词管理器/src/app/page.tsx#L570-L578)（本地模式连接成功分支，-13/+7 行）。
- **修复背景确认**：SQLite 库经导入脚本重建为 `randomUUID` 新 id，浏览器 localStorage 仍留 Supabase 时代旧 UUID 卡片；旧 `mergeLocalOnlyIntoRemoteSnapshot` 把"服务器没有的本地卡片"（实为旧 UUID 残留）并入视图 → 120×2=240。修复改为本地模式下服务器为唯一事实来源，直接覆盖。
- **静态验证**：`npx tsc --noEmit` 0 error；`npm run lint` 0 error（8 warnings，均在 scratch/治理脚本）；`npm run build` 成功。
- **复审结论：修复正确，无新增 P0/P1。** 核查通过的关键点：
  1. **BUG-12 兜底保留**：覆盖前仍调用 `backupLocalSnapshot()`（page.tsx:556），localStorage 四键滚动备份在位，误覆盖可从 `preconnect-backup` 找回。
  2. **空库首次上传分支未被误伤**：`remote.cards.length === 0 && local.length > 0` 时仍会把本机数据推上服务器（page.tsx:558-569），"服务器空库 + 本地有数据"不会误清。
  3. **持久化闭环**：`setCards(remote.cards)` 触发既有 saveCards effect，localStorage 旧 UUID 残留随后被服务器权威数据覆写清除，不会下次连接再复发。
  4. **`mergeLocalOnlyIntoRemoteSnapshot` 非死代码**：云端 Supabase 分支（page.tsx:425）仍在调用，仅从本地分支移除。
  5. **tombstone 过滤一致**：覆盖分支对 tags/promptTags 保留 `deadTagIds()` 过滤，与 SSE 回调（page.tsx:580-587）口径一致。
- **有意的行为回归（trade-off，需知情）**：本地模式下，离线期间仅存于本机的卡片/标签不再被自动合并找回——重连或刷新后将被服务器快照覆盖（可从 `preconnect-backup` 手动恢复）。当前 Mini 单设备使用模式下无实际影响；若未来恢复多设备使用，需重新评估此取舍（与 §4.3-1 Supabase 回退路径去留一并决策）。
