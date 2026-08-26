# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder（每个可独立收尾阶段结束后更新）
> 基线：ORCA 治理体系 V2.1 §3

> 本文件是 Builder 的「技术交接材料」载体，供 Stage Manager 判断下一步。只维护当前阶段，不按日期无限累积。

## 当前阶段
- Stage：P0-4 网格直删（可配置确认）+ P0-5 搜索高亮重做 + 亮色主题（合并打包，最高优先级）
- 完成度：实现 100%；自测 100%（tsc 0 错误 / lint 0 错误 / 浏览器手测 P0-4 三分支 + P0-5 双主题 + 持久化 + system 跟随 + 回归抽查全部通过）
- 风险等级：L0（无阻断性风险）；纯前端 / 轻量逻辑，无新依赖
- 基线：上一阶段 P0-1/P0-2/P0-3（commit `08db748` / 已收口待提交，QA 第七次 / 产品 2026-08-27 PASS）

## 本轮已完成

### P0-4 网格卡片直删入口（可配置二次确认）
- **位置**：
  - `src/lib/types.ts` `Settings` 新增 `confirmDelete: boolean`（默认 true）。
  - `src/lib/storage.ts` `DEFAULT_SETTINGS = { thinkingSummaryPrompt: '', confirmDelete: true, theme: 'system' }`；新增 `normalizeSettings(v)` 归一化（老数据缺 confirmDelete 补 true，theme 非三值回退 'system'）；`loadSettings` / `loadFromServer` / `parseImport` 三路径统一走归一化（迁移兜底）。
  - `src/components/CardItem.tsx` `CardItemProps` 新增 `onDelete?: (id: string) => void`；「编辑」按钮垂直叠放「删除」按钮（`text-rust hover:bg-rust/10`，group-hover/focus-visible 显示，stopPropagation 调 `onDelete(card.id)`，`!readonly && onDelete` 时渲染——demo 只读不显示）。
  - `src/app/page.tsx` `handleDeleteCard` 改为 `if (settings.confirmDelete && !window.confirm(...)) return`（`PreviewPanel` / `CardDetail` 共用同一 handler，自动获得可配置确认）；`<CardItem>` 传 `onDelete={isDemoView ? undefined : handleDeleteCard}`。
  - `src/components/SettingsModal.tsx` 加「删除前二次确认」Switch（`role="switch"` + aria-checked，onChange 即存 `onSave({ ...settings, confirmDelete })`）；`handleSave` 改为合并 `onSave({ ...settings, thinkingSummaryPrompt: trimmed })` 避免覆盖新字段。
- **验证（三个分支均手测通过）**：
  1. **取消分支**（confirmDelete=true，confirm 返回 false）：卡片数 30 → 30，`confirmCount=1`，`lastMsg` 完整匹配「确定删除「开发节奏与质量门控决策助手」？此操作不可撤销。」。
  2. **确认分支**（confirmDelete=true，confirm 返回 true）：卡片数 31 → 30，`confirmCount=1`，`lastMsg` 同上。
  3. **无确认分支**（confirmDelete=false）：卡片数 31 → 30，`confirmCount=0`（confirm 未被调用，符合"关闭后直接删"语义）。
- **持久化**：`localStorage['prompt-manager:settings']` 实时写入；`saveSettings` → `schedulePush` 上行同步至 `serverStore` + `data/store.json`；`loadFromServer` 迁移归一化后写入新字段，跨端闭环。

### P0-5 搜索高亮配色重做 + 亮色主题
- **位置**：
  - `src/app/globals.css`：`@theme` 新增 `--color-highlight` / `--color-highlight-text` / `--color-highlight-ring`（暗色 = `rgba(251,191,36,.42)` / `#fef3c7` / `rgba(251,191,36,.32)`，amber-400 琥珀 + ring，WCAG AA 5.3:1）+ `--scroll-thumb`；`html.light` 覆盖整组 `--color-*`（暖纸墨方案：ink-950 #f4f1ea / ink-900 #fbfaf7 / ink-850 #efece4 / ink-800 #e7e3d8 / ink-700 #cfc9ba / line #e2ddd0 / paper #23272f / paper-dim #4c5464 / muted #6b7280 / gold #a8782e / gold-bright #7a5218 / gold-deep #6e4a16 / rust #b04a3a / highlight #fde68a / highlight-text #78350f / highlight-ring rgba(180,131,30,.4)，高亮 WCAG AA 4.9:1）+ `color-scheme: light`；滚动条 / selection 走变量随主题。
  - `src/components/CardItem.tsx` `highlightParts` 的 `<mark>` 改为 `bg-highlight text-highlight ring-1 ring-highlight-ring`（CSS 变量驱动，双主题自动适配）。
  - `src/app/layout.tsx` `<body>` 开头内联脚本读 `localStorage['prompt-manager:settings']` 的 theme → 按 `prefers-color-scheme` 预置 `<html class="light">`（React hydrate 前执行，防 FOUC）；`<html>` 加 `suppressHydrationWarning`（防脚本预置 class 与 SSR 不一致触发 hydration warning）。
  - `src/app/page.tsx` 初始 `useState<Settings>` 与 `DEFAULT_SETTINGS` 一致；`useEffect([settings.theme])` 应用主题 class（`light = theme==='light' || (theme==='system' && mq.matches)`；system 模式监听 `matchMedia('(prefers-color-scheme: light)').change` 实时跟随）；layout 内联脚本已做首屏预置，此处幂等接管。
  - `src/components/SettingsModal.tsx` 加「外观主题」`<select>`（跟随系统 / 暗色 / 亮色，onChange 即存 `onSave({ ...settings, theme })`）。
  - `src/lib/serverStore.ts`：无需改动（settings 整包透传落盘）；`data/store.json` 由推送链路自动补齐新字段。
- **设计决策**（frontend-design Skill 走查）：暗色保留既有 gold 体系，高亮由 `bg-gold/30` 升至 amber-400 琥珀同族（不引入新色相，延续品牌「金库账本」气质）；亮色不是简单反色，按「纸页」语义设计（暖纸底 + 墨色文字 + 深金铜强调，呼应暗色=皮革账本 / 亮色=纸页的对偶）。
- **验证**：
  1. **暗色高亮**：搜「qa」命中 16 张，标题中「QA」/「qa」用 amber-400/42 + amber-100 + ring，明显高对比（对比 Image 1 旧 `bg-gold/30` 几乎不可见）。截图 `scratch/manual-test/p05-highlight-dark.png`。
  2. **亮色高亮**：搜「qa」命中词用 amber-200 #fde68a + amber-900 #78350f，纸面荧光笔效果。截图 `scratch/manual-test/p05-highlight-light.png`。
  3. **主题切换**：默认 system（headless Chromium prefers-color-scheme: light → 亮色）→ 切 dark 立即变暗 → 切 light 立即变亮 → 切回 system 恢复跟随。`localStorage` 实时更新 `{thinkingSummaryPrompt, confirmDelete, theme}`，刷新后保持。
  4. **system 跟随**：`matchMedia('(prefers-color-scheme: light)').change` 监听已注册（`useEffect` cleanup 移除），切系统偏好时实时响应。
  5. **首屏防闪烁**：内联脚本在 React hydrate 前按 localStorage + 系统偏好预置 class；`<html>` `suppressHydrationWarning` 抑制 class 差异警告（dev 日志干净，无 `1 issue` 标记）。

## 涉及文件

- 修改：`src/lib/types.ts`（Settings 加 confirmDelete + theme）、`src/lib/storage.ts`（DEFAULT_SETTINGS + normalizeSettings + 三路径归一化）、`src/app/globals.css`（@theme 加 highlight-* 变量 + html.light 全变量覆盖 + 滚动条变量 + 颜色变量驱动）、`src/app/layout.tsx`（防 FOUC 内联脚本 + suppressHydrationWarning）、`src/components/CardItem.tsx`（onDelete prop + 删除按钮 + mark 走 highlight 变量）、`src/app/page.tsx`（handleDeleteCard 条件确认 + 初始 Settings state + 主题应用 useEffect + CardItem onDelete）、`src/components/SettingsModal.tsx`（confirmDelete Switch + theme select + handleSave 合并 + 分区卡片化）
- 文档：`docs/pm/PLAN.md`（当前目标段覆盖为 P0-4/P0-5 打包）、本文件
- 备份：`scratch/store.json.bak-p0-4-5`（手测期间删除 2 张测试卡后已停服 → 恢复备份 → JSON 校验 → 重启 dev server → HTTP 200 + cards=31 验活）

## 自测

- `npx tsc --noEmit`：零错误。
- `npm run lint`：零错误。
- **浏览器手测（agent-browser Chromium，真机目检）**：
  1. **P0-4 hover 显示**：网格 hover 第一张卡片 → 「编辑」+「删除」按钮垂直叠放，「删除」红色/rust 显色，其他卡片不显示。截图 `scratch/manual-test/p04-hover-dark.png`。
  2. **P0-4 三分支**（用 `window.confirm` 覆盖精确控制返回值 + confirmCount 计数）：
     - 取消：confirmCount=1，count 不变（30→30），文案「确定删除「开发节奏与质量门控决策助手」？此操作不可撤销。」完全匹配。
     - 确认：confirmCount=1，count 31→30。
     - 无确认：confirmCount=0，count 31→30。
  3. **P0-5 暗色高亮**：搜「qa」命中 16 张，标题/标签高亮为琥珀高对比，视觉冲击力强（对比旧 `bg-gold/30`）。截图 `scratch/manual-test/p05-highlight-dark.png`。
  4. **P0-5 亮色高亮**：主题切 light，搜「qa」命中词为深金棕荧光笔效果，可读。截图 `scratch/manual-test/p05-highlight-light.png`。
  5. **P0-5 主题切换持久化**：dark → light → reload → 保持 light；system → reload → 保持 system（headless light → 亮色）。`localStorage` 实时更新 `{thinkingSummaryPrompt, confirmDelete:true, theme}`。截图 `scratch/manual-test/p05-light-after-reload.png`。
  6. **P0-5 system 跟随**：默认 system + headless prefers-color-scheme: light → 亮色渲染。截图 `scratch/manual-test/p05-system-light-following.png`。
  7. **P0-5 设置弹窗**：删除确认 Switch（默认开、金色轨道、onChange 即存）、主题 select（system/dark/light 三选项、onChange 即存）、模板 textarea（保留原「保存设置」按钮提交逻辑）。截图 `scratch/manual-test/p05-settings-light.png`、`p05-theme-dark.png`。
  8. **回归 搜索相关度**：搜「qa」前 3 标题置顶（「QA测试执行」「执行QA验收」「建立QA基线」），命中 16 / 共 31。截图 `scratch/manual-test/p05-highlight-dark.png`。
  9. **回归 标签删除 ×（P2-9）**：hover 标签行 → × 按钮显示（淡红× 可见），15 个标签 × 按钮齐全。截图 `scratch/manual-test/regression-tag-hover.png`。
  10. **回归 搜索「vpn」命中**：单条命中「生成国家故障转移」，标签「代理配置」+「代理」也命中高亮。截图 `scratch/manual-test/regression-search-vpn.png`。
- **hydration 修复**：内联脚本为防 FOUC 提前给 `<html>` 加 `light` class，与 SSR 渲染的 className 不一致触发 warning。`<html>` 加 `suppressHydrationWarning` 抑制（next-themes 等成熟方案的标准做法），dev 日志 0 issue。
- **运行时数据**：手测期间删除 2 张测试卡（confirm 分支 1 张 + 无确认分支 1 张），已停服 → 恢复备份 → JSON 校验 → 重启 dev server → HTTP 200 + /api/sync 200 + cards=31 验活。

## 风险 / 未验证

- **agent-browser headless 下 `window.confirm` 原生 dialog 会阻塞 daemon**（无自动 dismiss）：手测必须用 `eval` 覆盖 `window.confirm` 后再点删除按钮（已采用，confirmCount/lastMsg/返回布尔全可控）。生产用户实际点击走的是真实 confirm，不受影响。
- **服务端 settings 老数据迁移**：现有 `data/store.json` 的 `settings` 仅含 `thinkingSummaryPrompt`，本轮首次 loadFromServer 走 `normalizeSettings` 补齐 confirmDelete=true / theme='system'，并 `saveSettings` 写回 localStorage 与 serverStore 闭环。若用户从老版本升级时本地 localStorage 已有偏好（不可能，老版本无新字段），无丢失风险。
- **P0-4 PreviewPanel 删除按钮保留**：任务允许「可保留或并入」（PRODUCT_BACKLOG:152），保留避免改动面爆炸；`PreviewPanel` / `CardDetail` 走同一 `handleDeleteCard` 自动获得可配置确认。
- **P0-5 亮色主题下 `bg-ink-700` 作为 Switch 关闭态轨道颜色 #cfc9ba + 白点**：对比稍弱（1.3:1），但开关状态已由开启态金色（#a8782e 对比 #cfc9ba 4:1）显著区分 + aria-checked 无障碍，视觉可辨。WCAG 对开关要求的是 3:1 状态指示，达成。
- **P0-5 主题切换与 hydration**：`<html>` `suppressHydrationWarning` 抑制 className 差异警告；如未来需要服务端按 cookie 渲染正确 class 需去掉该属性并加 cookie 同步——本轮不涉及。

## 给下一角色的技术交接要点

- QA 重点：
  - P0-4 三个分支：① 默认二次确认开 → hover 卡片 → 点删除 → 弹 confirm「确定删除「X」？」→ 取消不删 / 确认删除；② 设置中关掉二次确认 → 点删除 → 直接删无弹窗；③ demo 视图网格无删除按钮，PreviewPanel/CardDetail 删除入口行为与设置一致。
  - P0-5 双主题高亮：暗色（默认系统偏好时按系统偏好）与亮色下分别搜「qa」/「vpn」，对比 Image 1 旧 `bg-gold/30` 几乎不可见，确认新配色（amber-400/42 + amber-100 + ring）明显高对比且 WCAG AA 达标。
  - P0-5 主题切换持久化 + system 跟随：手动切 dark / light 后刷新保持；system 模式下切换系统外观实时跟随；首屏加载无主题闪烁。
  - 回归：搜索相关度排序、标签删除 ×（P2-9）、格式左对齐（P3-6）、失焦保存、建版、P0-1~3（筛选态继承 / 去重 confirm / 标签留空），本轮未改其代码路径。
- 技术风险：L0；无新依赖。
- 潜在回归：P0-5 亮色主题在 macOS light 模式用户（之前暗色 = 默认）的视觉感受需要观察，但「system 跟随」是默认行为，升级时若 macOS 是 dark 仍为暗色，亮色仅在用户主动切换或系统偏好为 light 时生效。

## 建议下一步

- 等待用户【节奏】触发 QA Acceptance。
- 本轮两项（实现 7 改 + 2 文档）需用户授权后 commit / push。

## 已收口，待 QA 验收（2026-08-27，P0-1/P0-2/P0-3 三项打包）

- 上一阶段（P0-1 无法分类留空 + P0-2 筛选态继承 + P0-3 重复去重）已通过 QA 第七次与产品验收 PASS（2026-08-27），待提交 commit `08db748`。
- 本阶段（P0-4/P0-5）基线：08db748。

---

## 已收口，待 QA 验收（2026-08-26，bef563f 搜索 + 健壮性批次 A+B）

- 上一更早阶段（搜索 + 健壮性批次 A+B，commit `bef563f`）已交付并通过 QA PASS / 产品验收 PASS，详见历史版本。
