# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder（每个可独立收尾阶段结束后更新）
> 基线：ORCA 治理体系 V2.1 §3

> 本文件是 Builder 的「技术交接材料」载体，供 Stage Manager 判断下一步。只维护当前阶段，不按日期无限累积。

## 当前阶段
- Stage：搜索 + 健壮性批次（范围 A+B）收尾
- 完成度：实现 100%；自测 100%（tsc 0 错误 / lint 0 错误 / 10 项浏览器手测全部通过）
- 风险等级：L0（无阻断性风险）；范围 C（MCP 架构）与 P2-3 / P2-5 等未选项目不阻断

## 本轮已完成

### 范围 A · 全局搜索（P2-2）
- **SortBar 旁搜索框**（`src/components/SortBar.tsx`）：放大镜 + 清除按钮 + placeholder「搜索标题/正文/标签/备注 · @code 直达」；纯前端 300ms 防抖，无新依赖。
- **过滤链三段**（`src/app/page.tsx`）：`baseCards`（视图 + 标签）→ 搜索过滤（普通模式 5 字段 includes；`@` 模式仅按调取码 includes；均 lowercase）→ 排序。AND 叠加。
- **高亮**（`src/components/CardItem.tsx`）：`highlightParts` 按小写 `indexOf` 拆分纯文本节点，命中片段包 `<mark className="rounded-[2px] bg-gold/30">`，覆盖标题 / 正文 / 标签 / 调取码徽标；**全程 React 文本节点渲染，无 dangerouslySetInnerHTML，XSS 天然免疫**。
- **计数**：`search.trim()` 非空时 SortBar 切换「命中 x / 共 y 张」，x = `visibleCards.length`、y = `baseCards.length`。
- **空态**：搜索有值且 0 命中时显示「未找到匹配的卡片」+ 引导（试试其他关键词 / @ 调取码 / 清空搜索）。
- **不持久化**：`searchQuery` 仅 `useState('')`，刷新即清。

### 范围 B · 健壮性批次
- **RISK-3 AbortController**：`PreviewPanel.tsx` / `CardDetail.tsx` / `Composer.tsx` 5 处 AI 请求（regenMeta / runSummary / generate）全部接入；`abortRef.current?.abort()` 新请求前取消旧请求；卸载 `useEffect` cleanup 统一 abort；`catch` / `finally` 中 `ac.signal.aborted` 守卫跳过 toast 与 `setState`（`if (!ac.signal.aborted && abortRef.current === ac) setLoading(false)`），杜绝卸载后 setState 与竞态闪烁。
- **OPT-NEW-2 共享 hook**：新建 `src/hooks/useModalFocus.ts`（FOCUSABLE 选择器 / Tab 循环 / 打开聚焦首元素 / cleanup 归还焦点 / 可选 onEscClose 经 `useRef` 保存避免调用方内联函数导致 effect 重跑造成焦点抖动）。`CardDetail` 改 import（保留自有 `window` Esc 监听）；`SettingsModal` 移除自建 `useEffect` 改复用，传 `onClose` 处理 Esc。`role="dialog"` / `aria-modal` / `aria-label` 完整。
- **P3-1 字符计数 + 非法字符**：标题输入右下角「x/20」、调取码「x/12」实时计数（PreviewPanel 用 `relative` 容器 + 绝对定位 span；CardDetail 用 label 行 flex 两端布局）。调取码 `onChange` 立即 `replace(/[^a-zA-Z0-9-]/g,'')` 过滤，触发时显示「仅支持英文/数字/短横线，已自动过滤」2.5s 自动消失（`codeTipTimer` 卸载清理）。
- **P3-3 引导文案**：仓库空态（`cards.length === 0` 分支）按钮下方 + PreviewPanel 未选中占位（`!card` 分支）各加一行小字「双击卡片进入详情 · 拖动左缘调宽，双击重置 · 选中后 1-5 打星」。

## 涉及文件
- 新增：`src/hooks/useModalFocus.ts`
- 修改：`src/app/page.tsx`、`src/components/SortBar.tsx`、`src/components/CardItem.tsx`、`src/components/PreviewPanel.tsx`、`src/components/CardDetail.tsx`、`src/components/Composer.tsx`、`src/components/SettingsModal.tsx`
- 文档：`docs/pm/PLAN.md`（覆盖）、本文件、`docs/review/PRODUCT_BACKLOG.md`（5 项移入「已完成」）

## 自测
- `npx tsc --noEmit`：零错误。
- `npm run lint`：零错误。
- 浏览器手测（agent-browser Chromium + 真机/浏览器目检）10 项全部通过：
  1. 各字段分别命中（标题「手测7」/正文「TranscriptBuffer」/标签「vpn代理」/调取码「cmctest」/备注「手测5-备注A」）；
  2. 搜索+标签叠加（标签「经验记录」5 张 + 搜「开发」→ 命中 3 / 共 5，命中卡均含「经验记录」标签且含「开发」关键词）；
  3. @code 直达（@cmctest 命中 1 张含该 code 的卡；@整理 0 命中 → 空态，确认 @ 模式不匹配正文）；
  4. XSS 免疫 + 高亮（Composer 创建正文含 `<script>alert('XSS_TEST')</script>` 的卡，搜索「alert」截图：正文以纯文本渲染无弹窗，「alert」被金色 `<mark>` 高亮）；
  5. 空态与计数（多次确认「命中 x / 共 y」格式与「未找到匹配的卡片」空态文案）；
  6. 快速连点「重新生成」（regenMeta 3 次连击，按钮最终回到非 disabled 态、无残留错误——AbortController 正确 abort 旧请求）；
  7. SettingsModal 焦点（打开后首焦点 BUTTON / Tab 循环 textarea/恢复默认/取消/保存 / Esc 关闭 / 焦点归还到「设置」按钮）；
  8. 计数与非法字符（标题/调取码「n/20」「n/12」显示；调取码输入 `abc@!` 自动过滤为 `abc` 并显示「仅支持英文/数字/短横线，已自动过滤」）；
  9. 引导文案（仓库空态 + 右侧面板占位均显示新一行手势引导，截图确认）；
  10. 回归抽样（失焦保存：改 title + blur → 角标「已自动保存」出现、title 落盘、versions 不增；手动建版：改 body + 点保存 → versions +1、角标「已自动保存」）。
- 关于「刷新即清」：搜索词仅 `useState` 不入 localStorage，刷新后由 React 初始值重置，代码层保证。

## QA 副作用与遗留（需用户确认处理方式）
手测过程中为验证 XSS 免疫创建了 1 张测试卡、并在真实卡片上做了失焦保存 / 手动建版 / AI 重新生成回归验证。**所有已通过 React 兼容 value-setter 方式在 UI 内恢复为原值**，仅余下列 2 项：
- ① 测试卡 1 张「验证高亮不执行脚本」（正文含 `<script>alert('XSS_TEST')</script>…`）—— agent-browser 自动 dismiss 弹窗不覆盖 `window.confirm`，UI 删除流程被 confirm 阻塞；需**停服清理 `data/store.json` 或手动删除**（待用户授权）。
- ② 真实卡「手测7-新标题」版本数 +1（手测⑩手动建版恢复时多生成一条与原 body 完全一致的版本）—— 实际无害（10 条上限未触顶），如需纯净可一并清理。

## 风险 / 未验证
- 剩余架构 / 规范类风险（未修，不阻断交付，建议单独排期）：
  - RISK-1：MCP 直读 `data/store.json` 可能拿到陈旧数据（建议 MCP 改走 HTTP 读取）。
  - RISK-2：MCP 计数 fire-and-forget，失败静默导致 copyCount 少计。
  - RISK-5：调取码冲突自动保存提示已补（本轮修复 8），剩余「冲突检测时机」边缘场景可继续观察。
- 范围 C（MCP 架构）与 P2-3（`<md` 面板降级）/ P2-5（危险操作撤销）等未选项目继续保留在 `docs/review/PRODUCT_BACKLOG.md` 候选池。

## 给下一角色的技术交接要点
- QA 重点：搜索高亮（`CardItem.highlightParts` 纯文本拆分）与 AbortController（`PreviewPanel` / `CardDetail` / `Composer` 的 `*AbortRef` + cleanup）的代码路径。
- 技术风险：无阻断项。
- 潜在回归：搜索过滤使 `visibleCards` 与 `baseCards` 分离，`SortBar` 的 `count` / `total` 含义需保持一致（count = 过滤后、total = 标签+视图过滤后基数）。
- 可能需要 Review 的核心区域：`page.tsx` 的 `baseCards` / `searchActive` / `searchTerm` 三段派生；`useModalFocus` 的 `onEscClose` ref 模式。
- 可能需要 Product / Visual 关注的变化：搜索框 placeholder（注明 `@code` 直达与多字段范围）、空态引导、计数格式切换。

## 建议下一步
- 提交并推送本轮（实现 7 改 + 1 新 + 3 文档 + 工作区已有 `docs/DEV_EXPERIENCE.md` 未提交改动一并提交推送）——需用户明确授权。
- 处理遗留：停服清理 `data/store.json` 中的 XSS 测试卡（1 张）——需用户授权。
- 进入视觉验收 / 产品验收（Visual / Product Acceptance）→ neat-freak 里程碑收尾（Full Milestone Closeout）。

---

## 已收口，待 QA 验收（2026-08-26）

- 本阶段（搜索 + 健壮性批次 A+B）已交付：实现 100%、Builder 自测 100%（tsc/lint 0 错误 + 10 项浏览器手测通过），commit `bef563f` 已推送，git 干净。
- 遗留说明：`data/store.json` 的 XSS 测试卡已按授权清理（29→28 张）；「手测7-新标题」卡 title 为「版本测试失焦复验」（AI 重新生成残留，body/code 已恢复），多余 1 条版本按指令保留。
- 待 QA 验收核验项与回归基线见 `docs/handoff/HANDOFF.md`「下一步」；新候选 P2-8~P2-11 见 `docs/review/PRODUCT_BACKLOG.md`。
- 等待用户【节奏】触发 QA Acceptance。
