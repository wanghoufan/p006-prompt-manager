# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 本轮由 Builder 合并执行规划 + 开发（用户已确认合并角色、范围 A+B），基线 commit `44c4a3a`。

## 当前目标

本轮 **P0 用户反馈两项打包（P0-4 网格直删 + P0-5 高亮重做与亮色主题，最高优先级，用户已确认，Builder 合并规划+实现）**，纯前端 / 轻量逻辑，无新依赖：

1. **P0-4 网格卡片直删入口（编辑键下加删除，默认二次确认 + 设置可关闭）**：`CardItem` hover 时在「编辑」按钮下方出现小号红色/rust 色「删除」按钮，点击调 `onDelete(card.id)`（与 `handleDeleteCard` 共用）；`Settings` 新增 `confirmDelete: boolean`（默认 true），localStorage + serverStore + `data/store.json` 全链路同步，迁移缺省 true；`handleDeleteCard` 按 `settings.confirmDelete` 决定是否 `window.confirm`；`SettingsModal` 加「删除前二次确认」开关（onChange 即存）；readonly/demo 视图不显示删除。
2. **P0-5 搜索高亮配色重做 + 亮色主题（调用 frontend-design Skill 规范化）**：暗色高亮改高对比琥珀方案（`bg-highlight` 走 CSS 变量 `--highlight-bg`/`--highlight-text`，暗色 = amber-400/40 + amber-100 + ring，WCAG AA）；新增亮色主题（`theme: 'dark' | 'light' | 'system'`，暖纸墨方案：亮色下高亮 = amber-200 + amber-900）；主题切换入口放 `SettingsModal`（跟随系统 / 暗色 / 亮色），持久化到 `Settings` + localStorage/serverStore；`layout.tsx` 首屏内联脚本按 `prefers-color-scheme` 预置 class 防闪烁；`system` 模式监听系统偏好实时跟随。

## 验收标准

- **P0-4**：网格 hover 卡片出现「删除」按钮（demo/readonly 不显示）；点击删除 → 默认弹 `confirm`「确定删除「{title}」？此操作不可撤销。」→ 取消不删、确认删除；在设置中关闭「删除前二次确认」后点删除直接删、无弹窗；删除后卡片从网格与选中/详情态移除。
- **P0-5**：暗色下搜索「qa」命中词高亮为琥珀高对比（明显可辨识，对比截图对比 Image 1 旧 `bg-gold/30`）；亮色主题下整体为暖纸浅色底 + 深墨文字，高亮为深金棕琥珀（可读）；设置中切换「跟随系统 / 暗色 / 亮色」立即生效并持久化（刷新保持、服务端同步）；首屏加载无主题闪烁（FOUC）；`system` 模式下切换系统外观实时跟随。
- 既有回归不破坏：搜索相关度排序、标签删除 ×、格式规范化左对齐、失焦保存、建版、P0-1~3（筛选态继承 / 去重 confirm / 标签留空）、设置弹窗焦点陷阱（Esc/Tab 循环）。
- `npx tsc --noEmit` 零错误；`npm run lint` 零错误。

## 实施方案

- **P0-4 confirmDelete 链路**：
  - `src/lib/types.ts`：`Settings` 新增 `confirmDelete: boolean` 与 `theme: 'dark' | 'light' | 'system'`。
  - `src/lib/storage.ts`：`DEFAULT_SETTINGS = { thinkingSummaryPrompt: '', confirmDelete: true, theme: 'system' }`；`loadSettings` 迁移缺省（confirmDelete 非布尔补 true、theme 非三值补 'system'）；`loadFromServer` 与 `parseImport` 的 settings 走同一归一化函数。
  - `src/components/CardItem.tsx`：新增 `onDelete?: (id: string) => void`；`!readonly && onDelete` 时在「编辑」按钮下方垂直叠放删除按钮（`text-rust hover:bg-rust/10`，group-hover/focus-visible 显示，stopPropagation 调 `onDelete(card.id)`）。
  - `src/app/page.tsx`：`handleDeleteCard` 改为 `if (settings.confirmDelete && !window.confirm(...)) return` → 否则直接删；`CardItem` 传 `onDelete={isDemoView ? undefined : handleDeleteCard}`（PreviewPanel/CardDetail 已走同一 handler，自动获得可配置确认）。
  - `src/components/SettingsModal.tsx`：加「删除前二次确认」Switch（`role="switch"`，onChange 即存 `onSave({ ...settings, confirmDelete })`）；`handleSave` 改为合并 `onSave({ ...settings, thinkingSummaryPrompt: trimmed })` 避免覆盖新字段。
- **P0-5 高亮变量 + 双主题**：
  - `src/app/globals.css`：`@theme` 新增 `--color-highlight` / `--color-highlight-text` / `--color-highlight-ring`（暗色 = rgba(251,191,36,.42) / #fef3c7 / rgba(251,191,36,.32)）与 `--color-amber-*` 基色；`html.light` 覆盖整组 `--color-*`（暖纸墨：ink-950 #f4f1ea、ink-900 #fbfaf7、ink-850 #efece4、ink-800 #e7e3d8、ink-700 #cfc9ba、line #e2ddd0、paper #23272f、paper-dim #4c5464、muted #6b7280、gold #a8782e、gold-bright #7a5218、gold-deep #6e4a16、rust #b04a3a、highlight #fde68a、highlight-text #78350f、highlight-ring rgba(180,131,30,.4)）并切 `color-scheme: light`；滚动条/selection 走变量随主题。
  - `src/components/CardItem.tsx` `highlightParts`：`<mark className="rounded-[2px] bg-highlight text-highlight ring-1 ring-highlight-ring">`（CSS 变量驱动，双主题自动适配）。
  - `src/app/layout.tsx`：`<body>` 开头内联脚本读 `localStorage['prompt-manager:settings']` 的 theme（缺省 system）→ 按 `prefers-color-scheme` 给 `<html>` 预置 `light` class（React hydrate 前执行，防 FOUC）。
  - `src/app/page.tsx`：`useEffect([settings.theme])` 应用主题 class（`light = theme==='light' || (theme==='system' && matchMedia light)`；system 时监听 `change` 实时跟随）；初始 settings state 与 DEFAULT_SETTINGS 一致。
  - `src/components/SettingsModal.tsx`：加「外观主题」`<select>`（跟随系统 / 暗色 / 亮色，onChange 即存 `onSave({ ...settings, theme })`）。
  - `src/lib/serverStore.ts`：无需改动（settings 整包透传落盘）；`data/store.json` 由推送链路自动补齐新字段。

## 进行中 / 待办

- 本轮两项：P0-4 / P0-5（最高优先级，Builder 合并规划+实现，完成后待【节奏】触发 QA 验收）。
- 不在本轮范围（保留候选池）：P2-11 批量管理、P2-3 `<md` 面板降级、P2-5 危险操作撤销、P2-7 空/离线态区分、P3-2 版本 diff、P3-4 Composer 自适应等，见 `docs/review/PRODUCT_BACKLOG.md`。

---

## 已收口（2026-08-26，commit bef563f）

- 本轮（搜索 + 健壮性批次 A+B）已交付并通过 QA PASS / 产品验收 PASS，详见 `docs/progress/CURRENT_STAGE.md` 与 `docs/handoff/HANDOFF.md`。
- 实现：SortBar 搜索框 + 三段过滤链（baseCards→搜索→排序，AND 叠加）+ `highlightParts` `<mark>` 高亮（XSS 免疫）+ 命中计数/空态引导（刷新即清）+ AbortController 5 处 + `useModalFocus` 共享 Hook + 字符计数/非法字符提示 + 引导文案；自测 10 项、tsc/lint 零错误。
- 下轮待排期：P2-8~11 / P3-6 等，见 `docs/review/PRODUCT_BACKLOG.md` 候选池。

---

## 已收口（2026-08-26，P2-8/P2-9/P3-6 三项打包，待提交）

- 本轮三项打包已交付并通过 QA PASS 第六次与产品验收 PASS（2026-08-26），详见 `docs/progress/CURRENT_STAGE.md` 与 `docs/handoff/HANDOFF.md`。
- 实现：`relevanceScore`（title 4/code 3/tag 3/notes 2/body 1，`toLowerCase()` 大小写不敏感）+ `compareBySortMode` 二级排序（`@code` 隔离）；`TagPanel` TagRow 重构 + `handleDeleteTag` 批量移除（confirm、选中态取消、总数不变）；`normalizeBody` 5 步左对齐（去 tab/纯空白归一/最多 4 空格/去首尾空行/合并连续空行）于 `saveBodyOnly`/`saveBodyWithVersion` 与导入路径统一生效；自测 7 项、tsc/lint 零错误。
- 下轮待排期：P2-10/P2-11/P2-3 等，见 `docs/review/PRODUCT_BACKLOG.md` 剩余候选池。

---

## 已收口（2026-08-27，P0-1/P0-2/P0-3 三项打包，待提交）

- 本轮 P0 用户反馈三项打包已交付并通过 QA 第七次与产品验收 PASS（2026-08-27），详见 `docs/progress/CURRENT_STAGE.md` 与 `docs/handoff/HANDOFF.md`。
- 实现：`DISCARD_TAGS` 5 脏标签+`normalizeTags`（大小写不敏感）于 `ai.ts` 归一、`META_PROMPT` 禁止占位（`parseTags` 不过滤）；`handleCreate` 筛选态 `selectedTag` 强制首位去重≤3；`normalizeBody` 全等比对 `confirm` 去重（空/不同不弹，首个仅一次）；自测 7 项逻辑+手测、tsc/lint 零错误。
- 下轮待排期：P0-4 网格直删（可配置确认）与 P0-5 高亮+亮色主题、P2-11/P2-3 等，见 `docs/review/PRODUCT_BACKLOG.md` 剩余候选池。

---

## 已收口（2026-08-27，P0-4/P0-5 两项打包，待提交）

- 本轮 P0-4/P0-5 两项打包已交付并通过 QA 第八次与产品验收 PASS（2026-08-27，P0-6 二次配色待优化），详见 `docs/progress/CURRENT_STAGE.md` 与 `docs/handoff/HANDOFF.md`。
- 实现：`types.ts` `confirmDelete` + `storage.ts` 持久化归一化 + `CardItem` 网格直删（条件 confirm，demo 隐藏）+ `SettingsModal` Switch；`globals.css` 高亮变量 + `html.light` 纸墨 + `layout.tsx` 防 FOUC + `page.tsx` 主题系统跟随 + `SettingsModal` 主题 select；自测 10 项、tsc/lint 零错误。
- 下轮待排期：P0-6 高亮二次优化、P2-11/P2-3 等，见 `docs/review/PRODUCT_BACKLOG.md` 剩余候选池。
