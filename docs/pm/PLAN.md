# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 本轮由 Builder 合并执行规划 + 开发（用户已确认合并角色、范围 A+B），基线 commit `44c4a3a`。

## 当前目标

本轮两项增量，均进入开发期：

1. **A. 全局搜索（P2-2）**：`SortBar` 旁新增搜索输入框，纯前端过滤（不引入任何依赖），300ms 防抖；过滤范围 = 标题 / 正文 / 标签 / 调取码 / 备注，大小写不敏感；与左侧标签筛选、排序叠加（AND 组合）；`@code` 片段按调取码匹配直达；命中关键词在卡片标题与正文预览高亮（`<mark>`，纯文本拆分渲染防 XSS）；搜索框有值时计数显示「命中 x / 共 y」；空结果显示空态引导；搜索词不持久化（刷新即清）。
2. **B. 健壮性批次**：
   - **RISK-3**：PreviewPanel / CardDetail / Composer 所有 AI 请求（regenMeta / runSummary / generate）接入 AbortController——新请求发出前 abort 上一个，组件卸载时 abort；请求进行中禁用触发按钮。
   - **OPT-NEW-2**：`useModalFocus` 抽为共享 Hook（src/hooks/useModalFocus.ts），SettingsModal 复用，补齐打开聚焦 / 关闭归还 / Tab 循环 / Esc 关闭 / aria 完整。
   - **P3-1**：标题输入「x/20」、调取码「x/12」实时计数；调取码输入非法字符即时提示「仅支持英文/数字/短横线，已自动过滤」并自动过滤。
   - **P3-3**：仓库空态与面板占位处各加一行引导「双击卡片进入详情 · 拖动左缘调宽，双击重置 · 选中后 1-5 打星」。

## 验收标准

- 搜索：各字段分别命中；搜索 + 标签筛选叠加正确；`@api` 直达（仅留 code 含 api 的卡）；高亮正确且正文含 `<script>` 文本的卡不被执行（XSS 免疫）；空态与计数正确；刷新即清。
- 健壮性：快速连点「重新生成」仅最后一次生效、无报错 toast；SettingsModal Tab 循环 / Esc 关闭 / 焦点归还；两个计数器与非法字符提示工作；引导文案显示。
- 既有回归不破坏：失焦保存、手动建版、回滚、导入导出 .md、冲突提示。
- `npx tsc --noEmit` 零错误；`npm run lint` 零错误。

## 实施方案

- **搜索状态**：`page.tsx` 增 `searchQuery`（立即值，受控输入）与 `debouncedQuery`（useEffect 300ms 防抖）。`visibleCards` 拆为三段：`baseCards`（视图 + 标签过滤）→ 搜索过滤（`@` 开头仅匹配 code，否则多字段 includes，均 lowercase）→ 排序。
- **SortBar**：新增 `search` / `onSearchChange` / `total` props；渲染搜索框（放大镜 + 清除按钮 + placeholder 注明 `@code 直达`）；`search.trim()` 非空时计数切换为「命中 x / 共 y」。
- **CardItem**：新增 `query` prop；组件内 `highlightParts(text, query)` 按小写 indexOf 拆分纯文本节点，命中片段包 `<mark>`（bg-gold/30），不触碰 dangerouslySetInnerHTML；标题 / 正文 / 标签 / 调取码徽标均高亮。
- **AbortController**：PreviewPanel / CardDetail 各加 `metaAbortRef` / `summaryAbortRef`，Composer 加 `abortRef`；fetch 传 `signal`；新请求前 `abort()` 旧请求；`catch`/`finally` 中 `ac.signal.aborted` 时跳过 toast 与 setState；卸载 `useEffect` cleanup 统一 abort。
- **useModalFocus**：新建 `src/hooks/useModalFocus.ts`（FOCUSABLE 选择器 + Tab 循环 + 打开聚焦首个可聚焦元素 + cleanup 归还焦点 + 可选 onEscClose 用 ref 保存避免依赖抖动）；CardDetail 移除组件内定义改 import（Esc 仍走原有 window 监听）；SettingsModal 移除自建 useEffect 改复用（传 onClose 处理 Esc）。
- **P3-1 计数**：PreviewPanel 标题输入容器 relative + 右下角「n/20」、调取码「n/12」（input 加右 padding）；CardDetail 的 label 行改 flex 两端布局加计数。调取码 onChange 先 `replace(/[^a-zA-Z0-9-]/g, '')` 过滤，若过滤掉字符则 setState 提示 + 2.5s 定时器消失（卸载清理）。
- **P3-3 引导**：`page.tsx` 仓库空态（cards.length === 0 分支）按钮下方加一行小字；`PreviewPanel` 未选中卡片占位（!card 分支）加同一行小字。

## 进行中 / 待办

- 剩余候选不在本轮范围：范围 C（MCP 架构）、P2-3（`<md` 面板降级）、P2-5（危险操作撤销）等，见 `docs/review/PRODUCT_BACKLOG.md`。

---

## 已收口（2026-08-26，commit bef563f）

- 本轮（搜索 + 健壮性批次 A+B）已交付并通过 QA PASS / 产品验收 PASS，详见 `docs/progress/CURRENT_STAGE.md` 与 `docs/handoff/HANDOFF.md`。
- 实现：SortBar 搜索框 + 三段过滤链（baseCards→搜索→排序，AND 叠加）+ `highlightParts` `<mark>` 高亮（XSS 免疫）+ 命中计数/空态引导（刷新即清）+ AbortController 5 处 + `useModalFocus` 共享 Hook + 字符计数/非法字符提示 + 引导文案；自测 10 项、tsc/lint 零错误。
- 下轮待排期：P2-8~11 / P3-6 等，见 `docs/review/PRODUCT_BACKLOG.md` 候选池。
