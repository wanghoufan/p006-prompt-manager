# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 本轮由 Builder 合并执行规划 + 开发（用户已确认合并角色、范围 A+B），基线 commit `44c4a3a`。

## 当前目标

本轮三项增量打包（P2-8 / P2-9 / P3-6），均进入开发期，低风险、无新依赖，纯前端 / 轻量逻辑：

1. **P2-8 搜索结果按相关度排序（标题命中优先）**：搜索激活（`search.trim()` 非空）时，`visibleCards` 在过滤后、排序前插入相关度打分；无搜索时维持原 sortMode；`@code` 直达保持仅按调取码匹配、排序不变。
2. **P2-9 左侧标签管理（删除标签 = 批量从卡片移除，不删卡片）**：TagPanel 每行标签右侧加删除按钮（hover 显示 ×），confirm 后批量从所有含该标签的卡片移除该标签条目（卡片原文不动，与 Flomo 语义一致）；标签计数归 0 时自动从左侧消失；空标签（[]）保留。
3. **P3-6 保存时自动规范化正文格式（左对齐风格）**：新增 `normalizeBody(body)` 工具，在 `saveBodyOnly` / `saveBodyWithVersion` 入口统一调用；`parseImport` / `parseMarkdownImport` 导入路径同步调用。

## 验收标准

- **P2-8**：搜「QA」时标题含 QA 的卡排首位，正文仅含 QA 的旧卡靠后；大小写不敏感与 `@code` 隔离保持；同分按现有 sortMode（updated/copies/rating）二级排序；无搜索时维持原 sortMode。
- **P2-9**：点击标签行 × → confirm「将从 N 张卡片中移除标签「X」，卡片本身不会删除」→ 确认后批量更新并触发 localStorage 落盘与 SSE 同步；标签计数为 0 时自动从左侧消失；只删标签不删卡、卡片原文不动；空标签（[]）保留。
- **P3-6**：粘贴带前导 tab / 空格的段落保存后，`whitespace-pre-wrap` 下全篇左对齐，无「上半靠左、下半靠右」错位；现有手写 Markdown 结构（≤4 空格缩进的列表嵌套 / 代码块）不被破坏。
- 既有回归不破坏：失焦保存、手动建版、`@code` 直达、搜索高亮、AI 请求 Abort、焦点闭环。
- `npx tsc --noEmit` 零错误；`npm run lint` 零错误。

## 实施方案

- **P2-8 相关度打分**（`src/app/page.tsx`）：模块级新增 `relevanceScore(c, term)`（title=4 / code=3 / tag=3 / notes=2 / body=1，命中取最高分）与 `compareBySortMode(a, b, mode)`（抽出现有三分支 sortMode 比较逻辑）；`visibleCards` 中 `searchActive && !searchTerm.startsWith('@')` 时先按 score desc 排序、同分再按 sortMode 二级排序；`@` 模式与无搜索维持原 sortMode。
- **P2-9 标签删除**（`src/components/TagPanel.tsx` + `src/app/page.tsx`）：TagPanel 新增可选 `onDeleteTag` prop；TagRow 重构为 div 容器（避免 button 嵌套），主按钮 flex-1 + 右侧 hover 显示 ×（focus-visible 也显示，键盘可达）；`page.tsx` 新增 `handleDeleteTag`：按 `cards` 统计含该标签卡片数 → `window.confirm` → `setCards(prev => prev.map(c => c.tags.includes(tag) ? { ...c, tags: c.tags.filter(t => t !== tag) } : c))`（复用现有 cards 落盘 + SSE 同步链）；被删标签为当前选中项时顺带取消选中；demo 视图不传 `onDeleteTag`。
- **P3-6 normalizeBody**（`src/lib/cards.ts` + `src/lib/storage.ts`）：`cards.ts` 新增 `normalizeBody(body)`：① 逐行去前导 tab；② 纯空白行归一为空行；③ 非空行前导空格保留最多 4 个（超过部分 collapse），避免破坏 Markdown 列表 / 代码块缩进；④ 去首尾空行；⑤ 合并连续空行（`\n{3,}` → `\n\n`，最多保留 1 个空行）。`saveBodyOnly` / `saveBodyWithVersion` 入口先 normalize 再落库（`saveBodyOnly` 的 `===` 短路比较在 normalize 之后进行）；`storage.ts` 的 `parseImport`（JSON）与 `parseMarkdownImport`（Markdown）导入卡片 body 同步 normalize，保证导入与新建一致。

## 进行中 / 待办

- 本轮三项：P2-8 相关度排序 / P2-9 标签管理 / P3-6 正文规范化。
- 不在本轮范围（保留候选池）：P2-10 网格直删、P2-11 批量管理、P2-3 `<md` 面板降级、P2-5 危险操作撤销、P2-7 空/离线态区分、P3-2 版本 diff、P3-4 Composer 自适应等，见 `docs/review/PRODUCT_BACKLOG.md`。

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
