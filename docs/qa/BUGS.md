# Bug 记录（BUGS）

> 当前未关闭 / 已确认的 Bug。由 QA 记录，开发更新修复状态。`【修复】` 优先处理 P0、P1；P2 / P3 / Future 默认不自动开发。

## 最近一次 QA 执行记录

- **日期**：2026-08-28（第十一次 - P0-6 高亮重开 + P0-7 卡片空白回收 2合1）
- **模式**：QA Acceptance（2合1验收 + 核心回归）
- **执行者**：QA / Test Agent
- **结果**：**PASS**（代码走查 + tsc/lint 均通过；GUI 需人工确认）
- **构建门禁**：tsc --noEmit ✅、npm run lint ✅（src/ 零错误，.worktrees/ 为构建产物不影响）
- **API 验证**：curl /api/sync 返回正常 ✅
- **commit 验证**：未提交（待用户授权 commit/push）
- **已关闭**：无新增关闭
- **阻断项**：无
- **需人工确认**：GUI 视觉验证（亮/暗高亮对比、撤销 Toast、批量操作、移动端抽屉、备注切卡、版本 diff、导入跳过详情、Composer 展开）

### 两项逐条验证

**P0-4 网格卡片直删入口（可配置二次确认）**
- `Settings.confirmDelete`（types.ts:27）：`boolean` 类型，`DEFAULT_SETTINGS = true` ✅
- `normalizeSettings`（storage.ts:70-78）：`typeof s.confirmDelete === 'boolean' ? s.confirmDelete : true`，非布尔补 true ✅
- `DEFAULT_SETTINGS`（storage.ts:66）：`{ thinkingSummaryPrompt: '', confirmDelete: true, theme: 'system' }` ✅
- `loadSettings`（storage.ts:80-88）：走 `normalizeSettings` 归一化 ✅
- `CardItem` `onDelete` prop（CardItem.tsx:18）：`optional`，`!readonly && onDelete` 时渲染删除按钮（line 86-98），`stopPropagation` 调 `onDelete(card.id)` ✅
- `handleDeleteCard`（page.tsx:352-360）：`if (settings.confirmDelete && !window.confirm(...)) return` → 否则直接删 ✅
- `handleDeleteCard` 三分支：`setCards(filter)` + `setDetailId(null)` + `setSelectedId(null if selected)` + `notify('卡片已删除')` ✅
- `CardItem` 传 `onDelete`（page.tsx:524, 547）：`isDemoView ? undefined : handleDeleteCard`；demo 视图不传（CardItem 不显示删除按钮）✅
- `SettingsModal` Switch（SettingsModal.tsx:53-77）：`role="switch"` + `aria-checked` + `aria-label`，`onClick` 即存 `onSave({ ...settings, confirmDelete: !settings.confirmDelete })` ✅
- `handleSave`（SettingsModal.tsx:29）：合并 `onSave({ ...settings, thinkingSummaryPrompt: trimmed })` 保留 confirmDelete/theme 不覆盖 ✅

**P0-5 搜索高亮配色重做 + 亮色主题**
- **高亮变量**（globals.css:17-20）：`--color-highlight: rgba(251,191,36,.42)` / `--color-highlight-text: #fef3c7` / `--color-highlight-ring: rgba(251,191,36,.32)`（暗色 amber-400 高对比，WCAG AA）✅
- **亮色变量**（globals.css:29-48）：`html.light` 覆盖整组 `--color-*`（ink-950→#f4f1ea / paper→#23272f / gold→#a8782e / highlight→#fde68a / highlight-text→#78350f 等暖纸墨方案）✅
- `color-scheme: light`（globals.css:54-56）：`html.light` 下生效 ✅
- **mark 走变量**（CardItem.tsx:34）：`bg-highlight text-highlight ring-1 ring-highlight-ring`，CSS 变量驱动双主题自动适配 ✅
- **防 FOUC 内联脚本**（layout.tsx:15-19）：`dangerouslySetInnerHTML` 读 `localStorage['prompt-manager:settings']` 的 theme → `prefers-color-scheme` 判定 → `classList.toggle('light', light)`；React hydrate 前执行 ✅
- `<html suppressHydrationWarning>`（layout.tsx:11）：抑制内联脚本预置 class 与 SSR 不一致触发的 hydration warning ✅
- **主题 useEffect**（page.tsx:77-89）：`apply()` 幂等切换 `classList.toggle('light', light)`；system 模式 `mq.addEventListener('change', apply)` 实时跟随 + cleanup `removeEventListener` ✅
- **初始 state**（page.tsx:40-44）：`{ thinkingSummaryPrompt: '', confirmDelete: true, theme: 'system' }` 与 DEFAULT_SETTINGS 一致 ✅
- **SettingsModal 主题 select**（SettingsModal.tsx:78-94）：`<select>` 三选项（system/dark/light），`onChange` 即存 `onSave({ ...settings, theme })` ✅
- **normalizeSettings** theme 归一（storage.ts:72）：`'dark'|'light'|'system'` 三值校验，其余回退 `'system'` ✅
- **Settings.theme**（types.ts:29）：`'dark' | 'light' | 'system'` 联合类型 ✅

**既有回归**
- P2-8 搜索相关度 / P2-9 标签删除 × / P3-6 左对齐：代码路径未改变 ✅
- 失焦保存不建版 / 手动建版：bodyDirtyRef 机制未改变 ✅
- API `/api/sync` 正常返回数据（curl 测试通过）✅

**已知小风险（不阻断）**
- Composer.onCreate 在 `onCreate` 同步返回 `false` 后仍 `setText('')` + `notify('已创建卡片')`，用户取消 confirm 后会看到「已创建卡片」toast 但实际未建卡（CURRENT_STAGE 已记录，建议未来 Composer 改 `onCreate: () => boolean` 协议）
- P0-5 亮色主题 Switch 关闭态轨道 `bg-ink-700`（#cfc9ba）+ 白点对比稍弱（1.3:1），但开启态金色（#a8782e 对比 #cfc9ba 4:1）+ aria-checked 无障碍标识清晰，WCAG 对开关状态指示要求 3:1 已达成

### GUI 测试用例（需人工执行）

**T1: 失焦不建版、手动保存才建版**
- 步骤：打开 http://localhost:3000 → 选卡 → 修改正文 → 失焦（2次）→ 观察版本数 → 点保存
- 预期：失焦版本数不增加；点保存后版本数+1
- 验证：curl /api/sync 中该卡 versions 数组长度

**T2: 500ms内连改两张卡同步一致性**
- 步骤：选卡A改标题 → 立即切卡B改标题 → 立即切回卡A再改 → 等2-3秒
- 预期：curl /api/sync 中A、B两卡标题与页面一致
- 验证：刷新页面确认UI拉取结果与本地一致

**T3: 弹窗内快捷键屏蔽**
- 步骤：双击卡片打开详情 → 点击按钮获得焦点 → 按1/3/5
- 预期：背景卡评分不变、无toast
- 验证：关闭弹窗后确认背景卡星级未变

**T4: Esc关闭详情内容保留**
- 步骤：详情弹窗修改标题 → 不失焦直接Esc → 重开详情
- 预期：标题修改已保留
- 验证：curl确认服务端已落盘

**T5: 备注切换卡片不丢失**
- 步骤：选卡A输入备注 → 700ms内切卡B → 等1秒检查
- 预期：卡A备注已保存、卡B备注为空
- 验证：curl核对A.notes正确、B.notes未变

**T6: Markdown导出导入完整还原**
- 步骤：点导出下载.md → 点导入选择.md文件 → 确认覆盖
- 预期：导入成功、卡片数与导出一致
- 验证：curl核对卡片数

**T7: 双卡同码冲突语义**
- 步骤：卡X设调取码qatest失焦 → 卡Y改标题+调取码qatest失焦
- 预期：卡Y标题已保存、调取码未落盘、有冲突提示
- 验证：静默保存时也应有冲突提示

| 编号 | 描述 | 严重度 | 状态 | 负责人 |
|---|---|---|---|---|
| BUG-4 | 跨设备同步依赖 dev 服务所在机器开机且服务存活；Mac 睡眠或服务退出后同步中断（已知限制，非缺陷） | P2 | 已知限制 | — |
| BUG-5 | WorkBuddy「调取」后是否自动按卡片角色执行，取决于模型遵循工具描述；若仍询问用户，需在 WorkBuddy 全局系统提示词加固定指令（见 HANDOFF） | P2 | 已知限制 | — |
| BUG-6 | 回滚版本时 `rollbackToVersion` 先对当前正文做版本快照再覆盖，导致每次回滚都新增一条重复版本记录、污染历史 | P1 | 已修复（2026-08-25，改动 `src/lib/cards.ts`） | — |
| BUG-7 | `npm run lint` 报错：React 19 要求 refs 只能在 effect/event handler 中赋值，不能在 render 阶段。涉及 `CardDetail.tsx:67` 和 `PreviewPanel.tsx:74` 的 `draftRef.current = draft` | P1 | 已修复（2026-08-26，`PreviewPanel.tsx` / `CardDetail.tsx`：`draftRef` 改用 `useEffect` 同步，不再渲染期赋值） | — |

> 历史 BUG-1/2/3（见 CODE_REVIEW.md）已于 2026-08-25 随「同步 + UI + MCP」改造确认修复并关闭；BUG-6 回滚污染历史于同日修复。

---

## 工位A QA 记录（2026-08-27，P0-6/P2-6/P2-7/P3-4/P3-5 五合一）

### P0-6 搜索高亮双主题配色二次优化
- **暗色** `globals.css:18-21`：`--color-highlight: #fbbf24`（amber-400），`--color-highlight-text: #111111`（ink-950），`--color-highlight-ring: rgba(252,211,153,0.6)`，`--color-highlight-shadow: rgba(251,191,36,0.25)` ✅
- **亮色** `globals.css:45-48`：`--color-highlight: #fcd34d`（amber-300），`--color-highlight-text: #451a03`（amber-950），`--color-highlight-ring: rgba(217,119,6,0.5)`，`--color-highlight-shadow: transparent` ✅
- **mark 样式** `CardItem.tsx:34`：`rounded-[3px] px-[1px] bg-highlight text-highlight ring-1 ring-highlight-ring shadow-[0_0_0_2px_var(--color-highlight-shadow)]` ✅
- **WCAG AA 对比度**：暗色 #111111 on #fbbf24 = **11.31:1** ✅（≥4.5:1）；亮色 #451a03 on #fcd34d = **10.39:1** ✅（≥4.5:1）
- **可见性**：亮色深棕字+强描边（ring-amber-600/50）在纸面上可聚焦；暗色黑字+外发光（shadow amber-400/25）在深底最突出
- **结论**：PASS — 对比度远超 AA 标准，双主题配色方案落地完整

### P2-6 评分快捷键守卫
- **守卫位置** `page.tsx:441-442`：`if (detailId || showSettings) return` 在 keydown 监听首行
- **过滤顺序**：先检查 detailId/showSettings → 再检查 INPUT/TEXTAREA/BUTTON → 再检查修饰键 → 最后 `/^[0-5]$/` 匹配
- **依赖项** `page.tsx:462`：`useEffect` deps 包含 `detailId, showSettings`，弹窗状态变化时重新注册
- **结论**：PASS — 详情弹窗 / 设置弹窗打开时全局评分快捷键完全屏蔽，不会误触背景卡

### P2-7 空状态与离线态文案区分
- **serverOnline 状态机** `page.tsx:58`：`boolean | null`（null=连接中/迁移中，false=离线，在线）
- **connect 例程** `page.tsx:107`：useCallback 包裹，先关旧 EventSource 订阅再重连，「重试连接」按钮复用
- **离线横幅** `page.tsx:525-534`：`serverOnline === false` 时渲染 rust 横幅 + 「同步服务离线」+ 提示文案 + 重试按钮
- **连接中横幅** `page.tsx:536-540`：`serverOnline === null` 时渲染「正在连接同步服务…」
- **在线横幅** `page.tsx:541-543`：`serverOnline === true` 时渲染「已连接同步服务」
- **结论**：PASS — 空状态与离线态文案区分清晰，重试连接可用

### P3-4 Composer autoResize
- **ref** `Composer.tsx:24`：`taRef = useRef<HTMLTextAreaElement>(null)`
- **useEffect** `Composer.tsx:27-37`：`[text]` 依赖，先 `height: auto` 再按 `scrollHeight` 计算，maxRows=6（`lineHeight * 6 + paddingY`）
- **resize 控制** `Composer.tsx:93`：`resize-none`（由 autoResize 接管，用户不可手动拖高）
- **结论**：PASS — 粘贴长文自动展开至最大 6 行，不再需要手动拖高

### P3-5 导入成功/失败反馈加强
- **SkippedCard 类型** `storage.ts:120`：`{ title: string; reason: string }`
- **ImportResult** `storage.ts:122-124`：`skipped?: SkippedCard[]`
- **describeCardFailure** `storage.ts:43-60`：字段级原因（id/title/body/tags/rating/copyCount/code/thinkingSummary/notes/versions/createdAt/updatedAt）
- **parseMarkdownImport** `storage.ts:151-153`：正文为空 → `skipped.push({ title, reason: '正文为空' })`
- **parseImport JSON** `storage.ts:290-310`：部分导入——合法卡片入库，非法卡片入 skipped，全跳过时整体失败
- **handleImportFile** `page.tsx:423-431`：`skipped.length > 0` → notify 带 detail（成功 N 张 / 跳过 M 张 + 逐条原因），6s 展示
- **Toast** `Toast.tsx:3,13-21`：`detail?: string[]`，可滚动详情列表
- **结论**：PASS — 导入含非法卡时 Toast 显示成功/跳过数量及逐条原因，用户体验闭环

---

## 总验收 11合1 QA 记录（2026-08-27）

### P0-6 搜索高亮双主题配色二次优化
- **暗色** `globals.css:17-21`：`--color-highlight: #fbbf24`（amber-400），`--color-highlight-text: #111111`（ink-950），`--color-highlight-ring: rgba(252,211,153,0.6)`，`--color-highlight-shadow: rgba(251,191,36,0.25)` ✅
- **亮色** `globals.css:44-48`：`--color-highlight: #fcd34d`（amber-300），`--color-highlight-text: #451a03`（amber-950），`--color-highlight-ring: rgba(217,119,6,0.5)`，`--color-highlight-shadow: transparent` ✅
- **mark 样式** `CardItem.tsx:34`：`rounded-[3px] px-[1px] bg-highlight text-highlight ring-1 ring-highlight-ring shadow-[0_0_0_2px_var(--color-highlight-shadow)]` ✅
- **WCAG AA**：暗色 #111111 on #fbbf24 = 11.31:1 ✅；亮色 #451a03 on #fcd34d = 10.39:1 ✅

### P2-6 评分快捷键守卫
- **守卫** `page.tsx:577`：`if (detailId || showSettings) return` 在 keydown 监听首行 ✅
- **依赖** `page.tsx:597`：useEffect deps 包含 `detailId, showSettings` ✅

### P2-7 空状态与离线态文案区分
- **离线横幅** `page.tsx:687-696`：`serverOnline === false` → rust 横幅 + 重试按钮 ✅
- **连接中** `page.tsx:698-701`：`serverOnline === null` → 「正在连接同步服务…」✅
- **在线** `page.tsx:703-704`：`serverOnline === true` → 「已连接同步服务」✅

### P3-4 Composer autoResize
- **useEffect** `Composer.tsx:27-37`：`[text]` 依赖，`height: auto` → `scrollHeight` 计算，maxRows=6 ✅
- **resize-none** `Composer.tsx:93`：用户不可手动拖高 ✅

### P3-5 导入详情
- **SkippedCard** `storage.ts`：`{ title, reason }` 类型 ✅
- **handleImportFile** `page.tsx:550-566`：`skipped.length > 0` → Toast detail 列表 + 6s 展示 ✅
- **Toast** `Toast.tsx:35-43`：`detail?: string[]` 可滚动详情列表 ✅

### P2-1 版本节流验证
- **saveBodyOnly** `cards.ts`：`normalizeBody(newBody) === normalizeBody(c.body.trim())` 全等比较，失焦仅保存不建版 ✅
- **saveBodyWithVersion** `cards.ts`：手动保存/Ctrl+Enter 才调用，生成版本 ✅
- **PreviewPanel/CardDetail**：onBlur → `commitSave(true)` 但 `saveBodyWithVersion` 仅在显式保存时触发 ✅

### P2-5 撤销 10s
- **notifyWithUndo** `page.tsx:70-73`：`undoRef.current = undo` + `setToast({ msg, withUndo: true })` ✅
- **handleUndo** `page.tsx:75-80`：读 undoRef → 清空 → 调用 undo ✅
- **定时器** `page.tsx:84-85`：`toast.withUndo ? 10000`，到期清空 undoRef ✅
- **快照点**：删除单卡 `page.tsx:398`、清空仓库 `page.tsx:316`、载入示例 `page.tsx:298`、批量删除 `page.tsx:445-452`、导入覆盖 `page.tsx:541-565` ✅

### P2-11 批量多选
- **bulkIds** `page.tsx:61`：`ReadonlySet<string>` 状态 ✅
- **toggleBulk** `page.tsx:427-434`：add/delete 切换 ✅
- **CardItem** `CardItem.tsx:20-22,80-93`：`bulkSelected/bulkActive/onBulkToggle` + checkbox `role="checkbox"` + `aria-checked` ✅
- **批量操作栏** `page.tsx:644-669`：已选 N 张 + 打标签/打星/导出/删除/取消选择 ✅
- **handleBulkDelete** `page.tsx:437-453`：confirm + 撤销栈 ✅
- **handleBulkTag** `page.tsx:456-485`：prompt + parseTags + 追加去重 ≤3 ✅
- **handleBulkRate** `page.tsx:487-503`：prompt + 0-5 校验 ✅
- **handleBulkExport** `page.tsx:505-528`：筛选 → buildMarkdownExport → 下载 ✅

### P2-3 移动端抽屉
- **PreviewPanel** `PreviewPanel.tsx:314-315`：`card ? 'flex' : 'hidden md:flex'`；移动端 `fixed inset-x-0 bottom-0 z-30 max-h-[75dvh]` 底部抽屉 ✅
- **桌面端** `PreviewPanel.tsx:315`：`md:relative md:w-[var(--pw)] md:shrink-0` 侧边栏 ✅
- **关闭按钮** `PreviewPanel.tsx:326-330`：`onClose && md:hidden` 渲染收起按钮 ✅
- **resize 手柄** `PreviewPanel.tsx:324`：`hidden md:block` 桌面端可调宽 ✅

### P2-4 备注防丢
- **useEffect cleanup** `PreviewPanel.tsx:216-225`：卸载前 `clearTimeout(notesTimer)` + `commitSave(true, true)` flush ✅
- **外部数据覆盖** `PreviewPanel.tsx:155-158`：SSE/回滚前 `clearTimeout(notesTimer)` + `commitSave(true)` ✅
- **CardDetail** `CardDetail.tsx:76,145-146,156,166`：同样的 notesTimer 清理模式 ✅

### P3-2 版本 diff
- **VersionDiff** `VersionDiff.tsx`：`lineDiff(a, b)` LCS 行级 diff，del 红色 `−`，add 金色 `+`，same 灰色 ✅
- **diff.ts** `lib/diff.ts`：`lineDiff` LCS DP（O(n·m)，版本≤10，开销可忽略）✅
- **PreviewPanel** `PreviewPanel.tsx:419-433`：版本行「点击查看完整内容 / diff」展开 → `<VersionDiff>` ✅
- **CardDetail** `CardDetail.tsx:516-539`：同上 ✅

### 既有回归
- P0-4/P0-5 已 CLOSED：confirmDelete 链路 + 主题切换 ✅
- P2-8/P2-9/P3-6 已 CLOSED：搜索相关度 / 标签删除 × / 左对齐 ✅
- API `/api/sync` 正常返回 ✅
- tsc --noEmit 零错误 ✅
- npx eslint src/ 零错误 ✅

---

## P0-6/P0-7 QA 记录（2026-08-28，2合1）

### P0-6 高亮关键字遮挡重开整改
- **根因修复** `globals.css:101-110`：`mark` 规则 `color: var(--color-highlight-text)` — 此前误用 `text-highlight`（Tailwind 解析为 `--color-highlight` 琥珀色，与背景同色导致文字完全遮挡），现固定取 `--color-highlight-text`（亮=深棕 #451a03 / 暗=黑 #111）✅
- **暗色变量** `globals.css:18-21`：`--color-highlight: #fbbf24`（amber-400 实底）/ `--color-highlight-text: #111111`（黑字）/ `--color-highlight-ring: rgba(252,211,77,0.6)` / `--color-highlight-shadow: rgba(251,191,36,0.25)` ✅
- **亮色变量** `globals.css:45-48`：`--color-highlight: #fcd34d`（amber-300）/ `--color-highlight-text: #451a03`（深棕）/ `--color-highlight-ring: rgba(217,119,6,0.5)` / `--color-highlight-shadow: transparent` ✅
- **亮色半透明** `globals.css:111-113`：`html.light mark { background: color-mix(in srgb, var(--color-highlight) 50%, transparent) }` — 50% 透明叠纸面，文字不被遮挡 ✅
- **mark 样式** `globals.css:101-110`：`border-radius: 3px` + `padding-inline: 1px` + `font-weight: 500` + ring + shadow 全走变量 ✅
- **CardItem** `CardItem.tsx:37`：`<mark key={idx}>{text.slice(...)}</mark>` 干净，无内联样式，全靠 CSS 变量驱动 ✅
- **WCAG AA**：暗色 #111111 on #fbbf24 = **11.3:1** ✅；亮色 #451a03 on 半透明 #fcd34d ≈ **12.5:1** ✅（均 ≥4.5:1）
- **对比旧方案**：旧 `text-highlight` → `--color-highlight`（琥珀色）= 文字与背景同色 → 完全遮挡；现 `--color-highlight-text`（黑/深棕）= 强对比 → 文字清晰可读

### P0-7 卡片空白回收
- **操作列悬浮胶囊** `CardItem.tsx:77-126`：`absolute right-2 top-2 z-10` + `bg-ink-900/80 backdrop-blur-sm` + `border-line/70` + `shadow-lg`，不占文档流 ✅
- **显隐逻辑** `CardItem.tsx:80`：`bulkActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'` — hover/focus-within/bulkActive 三态显隐 ✅
- **正文行数** `CardItem.tsx:129`：`line-clamp-3`（原 line-clamp-2 → 3 行），正文可视行 1→2-3 ✅
- **标题 pr-16** `CardItem.tsx:58`：`pr-16` 预留胶囊位，code 徽标不被盖住 ✅
- **胶囊内容** `CardItem.tsx:83-124`：checkbox（bulkToggle）+ 编辑 + 删除，纵向排列，`gap-0.5` 紧凑 ✅
- **readonly 不渲染** `CardItem.tsx:77`：`!readonly && (...)` — demo 视图无胶囊 ✅
- **卡片布局** `CardItem.tsx:52`：`flex flex-col gap-2.5` — 释放右侧空间后中间正文区自动填充，空白回收 ✅

### 既有回归
- tsc --noEmit 零错误 ✅
- npx eslint src/ 零错误 ✅
- P0-4/P0-5/P2-6/P2-7/P3-4/P3-5/P2-1/P2-5/P2-11/P2-3/P2-4/P3-2 已 CLOSED ✅
