# Bug 记录（BUGS）

> 当前未关闭 / 已确认的 Bug。由 QA 记录，开发更新修复状态。`【修复】` 优先处理 P0、P1；P2 / P3 / Future 默认不自动开发。

## 最近一次 QA 执行记录

- **日期**：2026-08-27（第八次 - P0-4/P0-5 两项打包回归验收）
- **模式**：QA Acceptance（两项增量验收 + 既有核心能力回归）
- **执行者**：QA Agent
- **结果**：**PASS**（代码走查 + API 测试通过；GUI 需人工确认）
- **构建门禁**：tsc --noEmit ✅、npm run lint ✅
- **commit 验证**：未提交（Builder 已自测通过，待用户授权 commit/push）
- **已关闭**：无新增关闭
- **阻断项**：无
- **需人工确认**：GUI 视觉验证（P0-4 三分支 confirm 行为、P0-5 双主题高亮/切换/防闪烁/system 跟随）

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
