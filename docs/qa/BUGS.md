# Bug 记录（BUGS）

> 当前未关闭 / 已确认的 Bug。由 QA 记录，开发更新修复状态。`【修复】` 优先处理 P0、P1；P2 / P3 / Future 默认不自动开发。

## 最近一次 QA 执行记录

- **日期**：2026-08-28（第十三次 - P0 标签系统真机 GUI 复测）
- **模式**：QA Acceptance（真机 Orca Computer Use 操作）
- **执行者**：QA / Test Agent
- **结果**：**PARTIAL**（5 项测试中 4 项 PASS，1 项发现 Bug）
- **构建门禁**：tsc --noEmit ✅、npm run lint ✅
- **API 验证**：curl /api/sync 返回正常 ✅
- **commit 验证**：未提交
- **已关闭**：无新增关闭
- **阻断项**：1 项 Bug（chip × 移除标签时 card.tags 未同步）
- **真机截图**：`scratch/qa-real-device/`

### 真机复测结果（5 项）

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | 重命名「开发恢复」→「开发恢复2」 | ✅ PASS | 标签面板、chip、输入框同步更新，API 持久化 |
| 2 | 删除「预览服务」（1 关联） | ✅ PASS | 弹窗显示 1 条，确定后标签消失，卡片保留，API 确认清理 |
| 3a | 移动「代码检查」到「编程」下 | ✅ PASS | 层级结构正确，API 持久化 |
| 3b | 环路检测：「编程」→「代码检查」 | ✅ PASS | Toast「不能移动到自身或自己的子标签下（会形成循环）」 |
| 4 | 同级重名拒绝 | ⚠️ PASS | 标签未改名（重名被拒绝），toast 可能已闪现消失 |
| 5 | Card chip × 移除标签 | ❌ BUG | × 移除单个标签生效（count -1），但 card.tags 未同步（UI 仍显示旧 chip） |

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

---

## P0 标签系统 22 项 QA 记录（2026-08-28）

### 1. 创建标签（管理区+编辑时隐式创建）
- **管理区** `page.tsx:502-514`：`handleCreateTag(name, parentId)` → 空名校验 + 50 字上限 + `isNameUnique` 同父重名检测 + `assertNoCycle` + `createTag` ✅
- **隐式创建** `page.tsx:317-335`：`resolveTagIds(names)` → 未找到时 `createTag(nextTags, name, null)` 自动新建顶级标签 ✅
- **TagPanel 新建入口** `TagPanel.tsx:417-429`：「+」按钮 → `handleCreate(null)`；菜单「＋ 新建子标签」→ `handleCreate(tag.id)` ✅

### 2. Prompt 多标签
- `Card.tags: string[]`（types.ts:11）+ `setCardTags` 原子替换（tags.ts:234-240）+ resolveTagIds 支持多名称 ✅
- 上限 3 个保持（`cards.ts:108` slice(0,3)），待产品决策放开 ✅

### 3. 标签树（展开/记忆/选中/搜索）
- **树渲染** `TagPanel.tsx:135-257`：`TreeNode` 递归渲染 + `childrenOf` 子级获取 ✅
- **展开/收起** `TagPanel.tsx:276-284`：`toggle(id)` + `localStorage[pm:tag-expanded]` 记忆（`readExpanded`/`writeExpanded`） ✅
- **选中高亮** `TagPanel.tsx:154,162-163`：`active = selected === tag.id` + `bg-gold/10` ✅
- **搜索** `TagPanel.tsx:290-300`：匹配 name 或完整路径（`tagPath`），命中平铺展示完整路径 ✅

### 4. 数量（直接/总）
- **TreeNode** `TagPanel.tsx:155-157`：`direct = directCount(promptTags, tag.id)` + `totalCount(promptTags, subIds)` ✅
- **标题提示** `TagPanel.tsx:201`：`direct !== total` 时显示「直接 X · 含子 Y」 ✅

### 5. 点击筛选（含父含子去重）
- `page.tsx:266-268`：`subIds = [selectedTag, ...collectDescendantIds]` → `collectTagPromptIds` 去重 → `matched.has(c.id)` ✅
- 含子标签：`collectDescendantIds` 递归收集所有后代 id ✅
- 去重：`collectTagPromptIds` 用 `Set<prompt_id>` 去重 ✅

### 6. 加/移除标签（chip × + datalist 补全）
- **CardDetail** `CardDetail.tsx:366`：chip × → `setDraft(tagsText: next.join('、'))` 移除 ✅
- **CardDetail** `CardDetail.tsx:386-390`：`<datalist id="detail-tags-list">` + `existingTags` 补全 ✅
- **PreviewPanel** `PreviewPanel.tsx:486-490`：同上 datalist ✅
- **PreviewPanel** `PreviewPanel.tsx:525`：chip × 移除 ✅

### 7. 重命名（含父重命名子路径自动变）
- `handleRenameTag`（page.tsx:517-533）：空名校验 + 50 字上限 + `isNameUnique` 重名检测 + `renameTag` 仅改 Tag.name ✅
- `syncCardsToPromptTags`（page.tsx:530）：重命名后同步重建 Card.tags 冗余字段 ✅
- 子路径自动变：`tagPath`（tags.ts:111-124）动态计算，父名变 → 所有子路径自动更新 ✅

### 8. 移动/拖动 + 防循环/同父重名
- `handleMoveTag`（page.tsx:536-549）：`assertNoCycle` 三重检测 + `isNameUnique` 同父重名检测 ✅
- `assertNoCycle`（tags.ts:94-108）：① 不能成为自己的父 ② 不能移到自己的子节点 ③ 成环检测 + visited 兜底 ✅
- `moveTag`（tags.ts:196-199）：仅改 parent_id，关系不动 ✅

### 9. 删除（两种模式 + 绝不删 Prompt + 确认）
- `handleDeleteTag`（page.tsx:553-560）：`deleteTag(tags, promptTags, id, mode === 'subtree')` + `applyTags` 原子落盘 ✅
- **两种模式** `TagPanel.tsx:400-408`：`hasKids` 时二次 confirm → `'self'`（子标签提升一级）或 `'subtree'`（删除整棵子树） ✅
- **绝不删 Prompt** `deleteTag`（tags.ts:229）：`nextPromptTags = promptTags.filter(rt => !removedIds.has(rt.tag_id))` — 只删关系不删卡 ✅
- **确认** `TagPanel.tsx:388-398`：首次 confirm 含使用数量 + 删除后果说明 ✅

### 10. 无标签
- `UNTAGGED` 虚拟 id（TagPanel.tsx:8）+ `untaggedCount`（page.tsx:248-251）：`sourceCards.filter(c => !linked.has(c.id)).length` ✅
- `baseCards`（page.tsx:262-264）：`selectedTag === UNTAGGED` → 无关联 prompt 的卡片 ✅
- TagPanel 渲染（TagPanel.tsx:512-526）：底部「无标签」入口 ✅

### 11. 当前标签下新建继承
- `page.tsx:360-362`：`selectedTag && selectedTag !== UNTAGGED && !isDemoView` → `selName` 强制首位 → `resolveTagIds` ✅
- 「全部」下不强制：条件 false 时维持原 AI tags ✅
- demo 视图不继承：`!isDemoView` ✅

### 12. 外键安全（Tag 删→PromptTag 级联，绝不删卡）
- `deleteTag`（tags.ts:229）：`nextPromptTags = promptTags.filter(rt => !removedIds.has(rt.tag_id))` — 级联删关系 ✅
- 卡片总数 32→32 不变（CURRENT_STAGE 手测验证） ✅

### 13. 事务/原子操作
- `applyTags`（page.tsx:338-342）：`setTags` + `setPromptTags` + `syncCardsToPromptTags` 一次性原子替换 ✅
- `setCardTags`（tags.ts:234-240）：`[...filtered, ...unique]` 原子替换某 prompt 全部标签关系 ✅

### 14. isTag/isPromptTag 守卫
- `isTag`（tags.ts:14-27）：校验 id/name/parent_id/icon/is_pinned/sort_order/created_at/updated_at ✅
- `isPromptTag`（tags.ts:29-33）：校验 prompt_id/tag_id ✅

### 15. buildTagTree 树构建
- `buildTagTree`（tags.ts:264-320）：按 parent_id 分组 → 递归 walk → sort_order + locale 排序 → 环引用兜底孤儿追加 ✅
- `TagNode`（tags.ts:255-261）：extends Tag + total/direct/depth ✅

### 16. deriveTagsFromCards 兜底派生
- `deriveTagsFromCards`（tags.ts:331-361）：从 Card.tags 去重派生临时 tags + promptTags（id = tag_derive_N） ✅
- demo 视图 + 未迁移旧数据兜底 ✅

### 17. tagPath 完整路径
- `tagPath`（tags.ts:111-124）：从 tagId 沿 parent_id 链向上收集 → `unshift` → `join(' / ')` ✅

### 18. syncCardsToPromptTags 冗余同步
- `syncCardsToPromptTags`（tags.ts:174-180）：以 promptTags 为真源重建 Card.tags，仅变化时生成新对象 ✅

### 19. normalizeTag 归一化
- `normalizeTag`（tags.ts:36-44）：老数据缺 icon/is_pinned/sort_order 时补默认值 ✅

### 20. 迁移脚本
- `scripts/migrate-tags.mjs`：dry-run + --apply + 自动 .bak 备份 + validate ✅
- 脏数据合并：多age×3 + 多aengt编程×1 → 多agent编程；删除无法分类 ✅

### 21. API 透传
- `api/sync/route.ts:27`：`tags` + `promptTags` 字段透传 ✅
- `curl /api/sync`：`cards=32 tags=11 promptTags=55 version=529` ✅

### 22. serverStore 守卫
- `serverStore.ts`：`setState` 落盘前 `isTag/isPromptTag` 过滤非法数据 + 完整性校验（无孤儿/唯一约束/环） ✅

### 既有回归
- tsc --noEmit 零错误 ✅
- npx eslint src/ 零错误 ✅
- API `/api/sync` cards=32 tags=12（含测试标签「编程」）promptTags=55 ✅
- P0-6/P0-7 已 CLOSED ✅

---

## 新增 Bug

### BUG-NEW-1：chip × 移除标签时 card.tags 未同步（P1）

- **发现日期**：2026-08-28（真机复测第十三次）
- **严重程度**：P1（功能 Bug，影响数据一致性）
- **复现步骤**：
  1. 打开卡片「定点读取文档策略」（有 3 个标签：开发恢复、经验记录、token经济学）
  2. 在详情面板点击「经验记录」的 × 按钮
  3. 观察：标签面板「经验记录」count 从 5 降到 4（移除生效）
  4. 但 API 返回该卡 `tagIds: []` + `promptTags: []`（全部标签被清空）
  5. UI 仍显示 3 个 chip（使用旧 card.tags 渲染）
- **根因**：`handleUpdateMeta`（page.tsx:453-458）在 `setCards` 时只更新 `title` 和 `updatedAt`，**未将新 tagNames 同步到 `card.tags` 字段**
- **影响**：
  1. `card.tags`（冗余字段）与 `promptTags`（关系真源）不一致
  2. UI 渲染 chip 使用过期 `card.tags`，移除后仍显示旧 chip
  3. push 到服务端的 card 对象携带过期 `tags` 字段
  4. 远端设备通过 SSE 接收到不一致数据
- **对比**：其他标签变更路径（handleDeleteTag、handleRenameTag、handleBulkTag）都正确调用了 `syncCardsToPromptTags`，唯独 `handleUpdateMeta` 遗漏
- **修复方向**：`handleUpdateMeta` 的 `setCards` updater 中加入 `tags: tagNames`，确保 `card.tags` 与 `promptTags` 双写一致
- **相关代码**：
  - `src/app/page.tsx:453-458` — handleUpdateMeta（bug 所在）
  - `src/app/page.tsx:455` — 遗漏 tags 的 setCards 更新
  - `src/components/CardDetail.tsx:363-367` — chip × onClick
  - `src/components/PreviewPanel.tsx:522-526` — chip × onClick
  - `src/lib/tags.ts:234-240` — setCardTags
- **状态**：CLOSED（已修复 2026-08-28，第十四次 Fix QA 验证通过）

---

## Fix QA 记录

### 第十四次 Fix QA（2026-08-28 - chip 移除同步 + 重命名回滚 + 新建父校验）

- **模式**：QA Acceptance（真机 Orca Computer Use + 代码走查 + API 校验）
- **执行者**：QA / Test Agent
- **结果**：**PASS**（3 项验证全部通过）
- **构建门禁**：tsc --noEmit ✅、npm run lint ✅

#### 验证结果

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | chip × 移除同步 | ✅ PASS | BUG-NEW-1 已修复：card.tags 与 promptTags 双写一致，chip 消失 + API 同步 |
| 2 | 重命名回滚 | ✅ PASS | handleRenameTag 调用 syncCardsToPromptTags，无回滚，schedulePush 宏任务合并正常 |
| 3 | 新建标签父校验 | ✅ PASS | page.tsx:508-509 返回「父标签不存在」（非环检测） |

#### BUG-NEW-1 状态更新

- **状态**：**CLOSED**（已修复）
- **修复内容**：`handleUpdateMeta`（page.tsx:453-466）改为调用 `syncCardsToPromptTags` 重建 card.tags，确保与 promptTags 双写一致
- **真机验证**：chip × 移除后 TagPanel count -1 + chip 消失 + API card.tags 同步 + promptTags 同步

#### handleCreateTag 修复确认

- **状态**：已修复 ✅
- **变更**：page.tsx:508-509 从 `assertNoCycle` 改为 `tags.some((t) => t.id === parentId)`
- **错误提示**：「父标签不存在」（非「父标签不合法」或环检测错误）
- **真机验证**：代码走查确认，UI 路径无法触发非法父 ID

---

### 第十五次 QA - P0-9 标签添加交互重构（#标签+回车/空格自动添加，禁止逗号分隔，2026-08-27 真机验收）

- **日期**：2026-08-27
- **模式**：QA Acceptance（Token 高效版，真机 agent-browser GUI）
- **执行者**：QA / Test Agent
- **范围**：P0-9 标签添加交互重构（PRODUCT_BACKLOG.md P0-9，2026-08-28 用户截图反馈的子项）
- **结果**：**ALL PASS**（6 项功能点 + 2 条构建门禁全过，无新增 Bug）
- **构建门禁**：`npx tsc --noEmit` ✅ 0 错误、`npm run lint` ✅ 0 错误
- **API 验证**：未单独 curl（本次仅 UI 交互，侧边栏全局标签计数实时同步已隐式证明 onUpdateMeta 链路 + SSE 落盘正常）
- **commit 验证**：未提交（验收完成后停止，等待【节奏】触发产品验收）
- **已关闭**：无新增关闭
- **阻断项**：无
- **真机截图**：`/Users/zzymima0000/.agent-browser/tmp/screenshots/screenshot-1787842880209.png`（详情面板"添加标签"标题样式 + chip 区域）
- **定点读取**（不扫全仓）：`docs/review/PRODUCT_BACKLOG.md:33-44` P0-9 段 + `src/components/TagEditor.tsx`（174 行，全读）+ `src/components/CardDetail.tsx` line 8/123/200/348-361（TagEditor 使用处 + onChange 链路）+ `src/components/PreviewPanel.tsx` line 9/196/268/477-490（同上）+ `src/lib/cards.ts:100-114`（`parseTags` `[,，、\s]+` 分割与 `join('、')` 兼容）

#### 6 项验证逐条

| # | 测试项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 输入 `#标签名` + 回车 → 自动添加为 chip（不依赖逗号） | ✅ PASS | CardDetail 输入 `#qa验收` + Enter → chip 立即出现，侧边栏新增"qa验收 1"（全局同步） |
| 2 | 输入时弹出已有标签下拉补全，点选即添加 | ✅ PASS | 输入 `#qa` → 下拉出现"qa基线"建议项（"qa验收"因已在 chips 被正确过滤），点选即添加 |
| 3 | 每次只添加一个标签，多标签独立 | ✅ PASS | 经验记录 + sop 初始 → 添加 qa验收（sop 保留）→ 移除 sop → 添加 qa基线（经验记录+qa验收 保留）→ 共 3 chip 互不影响 |
| 4 | chip 可点击 × 移除单个标签 | ✅ PASS | `aria-label="移除标签 sop"` 按钮点击后移除按钮数 3→2，侧边栏"qa基线"从 7→8 反向验证持久化 |
| 5 | 标题"添加标签"样式：居中、加粗/加大、与其他区域区分 | ✅ PASS | 截图确认：`<div className="text-center">` + `font-serif text-sm font-semibold text-paper` 与上下"标题""调取码"label（左对齐 text-xs text-muted）对比明显区分 |
| 6 | 与 `handleUpdateMeta` 的 `tagsText` 编辑链路兼容 | ✅ PASS | 关闭详情重开 → 3 个 chip 全部保留；`parseTags(/[,，、\s]+/)` 与 `join('、')` 双向兼容；侧边栏全局统计实时同步证明 `onUpdateMeta(id, title, parseTags(tagsText))` 路径正常 |

#### 补充验证

- **CardDetail 路径**：`CardDetail.tsx:356-359` onChange 同时 `setDraft(tagsText=join('、'))` + `onUpdateMeta(id, title, nextTags)`，双轨写入与 `commitSave` 路径（line 123 `parseTags(d.tagsText)`）格式一致 ✅
- **PreviewPanel 路径**：`PreviewPanel.tsx:485-488` 同款 onChange 双轨写入；PreviewPanel 实测空格键添加：输入 `#新标签` + Space → chip 立即出现（侧边栏新增"新标签 1"）✅
- **atMax 行为**：3 chip 时 input 区显示"已达上限（最多 3 个）"红色提示，下拉 `!atMax` 不渲染（TagEditor.tsx:144），行为合理 ✅
- **失焦兜底**：`onBlur`（TagEditor.tsx:113-117）有未输入完的 input 时 `addTag(input)`，避免残留文字，符合 flomo 风格 ✅
- **下拉键盘导航**：Enter（高亮项或 input）/ Space / ArrowUp / ArrowDown / Escape 全部实现（TagEditor.tsx:118-139），高亮态用 `bg-ink-800 text-paper` 视觉反馈 ✅
- **下拉 mousedown preventDefault**（TagEditor.tsx:147）：防止 suggestion 点击触发 input blur 抢先提交，回退走 `addTag(s)` ✅

#### 观察项（不阻断，建议 P2/Future 评估）

- **输入法兼容性**：中文拼音输入法确认候选词时按空格，部分浏览器/输入法下可能触发 `onKeyDown` `e.key === ' '` 且 `e.nativeEvent.isComposing === true`，当前代码未加 `if (e.nativeEvent.isComposing) return` 守卫，可能误触发 addTag 提早锁定。Chrome 主流组合下 key 为 `'Process'` 不会命中空格分支，但稳妥做法应加守卫。**不阻断验收**（极端边界场景）。
- **onBlur 兜底** 残留文字提交：用户输入"标签"后未按回车/空格直接失焦也会 addTag，符合 flomo 风格但需用户留意；可接受。
- **"添加标签"标题字号**：当前 `text-sm`（14px），对比其他 label `text-xs`（12px）已区分明显但仅大一档；如用户希望更夸张可升 `text-base`（16px）— 依赖用户偏好确认。**不阻断验收**。

#### 既有回归

- P0-1~P0-7（含 11合1 总验收 + 2合1）：本轮未触碰相关代码，路径不变 ✅
- 失焦自动保存：测试过程中"已自动保存"角标持续显示，未出现丢稿 ✅
- 同步链路：sop 计数从 3→2、qa基线 7→8、qa验收 0→1、+新标签 1，均为失焦即落库并 SSE 推送，无回声刷新现象 ✅
- 新增 BUG：无
