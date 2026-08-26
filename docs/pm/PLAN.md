# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 本轮由 Builder 合并执行规划 + 开发（用户已确认合并角色、范围 A+B），基线 commit `44c4a3a`。

## 当前目标

本轮 **P0 用户反馈三项打包（P0-1 / P0-2 / P0-3，最高优先级，用户已确认一起做）**，均为低成本纯前端 / 轻量逻辑，无新依赖：

1. **P0-1 AI 无法分类时标签留空（堵住脏标签源头）**：AI 标签归一新增 `DISCARD_TAGS` 过滤 + 提示词约束；AI 无明确领域时 `tags` 为 `[]`，不再产生「无法分类」类占位标签；**存量污染不自动清理**（由 P2-9 标签管理手动删）。
2. **P0-2 标签筛选态下新建默认携带当前选中标签**：选中标签时新建卡片强制携带该标签（首位），其余由 AI 补充去重，最多 3 个；「全部」下维持原 AI 1~3 个。
3. **P0-3 重复内容去重提示**：新建提交前 `normalizeBody` 全等比对，命中 `window.confirm` 二次确认，取消中断、确认继续；空内容不触发。

## 验收标准

- **P0-1**：粘贴口语化无领域内容（如「测试语音输入法效果」）新建卡片，AI 无明确领域时 `tags` 为 `[]`，界面不出现「无法分类」标签；标签索引不再新增该标签。
- **P0-2**：选中「vpn代理（1 张）」标签时新建卡片必含 `vpn代理` 且位于首位，其余 0~2 个由 AI 补充（去重、最多 3 个）；在「全部」筛选下新建则不强制携带。
- **P0-3**：复制已有卡片正文新建时弹 `confirm`「检测到内容已存在（标题「X」），是否仍要添加？」→ 取消不新增、确认新增；不同内容不弹；空内容不触发；多次命中仅提示首个。
- 既有回归不破坏：搜索相关度、标签删除、格式规范化、失焦保存、建版。
- `npx tsc --noEmit` 零错误；`npm run lint` 零错误。

## 实施方案

- **P0-1 脏标签过滤**（`src/lib/cards.ts` + `src/lib/ai.ts` + `src/lib/prompts.ts`）：`cards.ts` 新增导出 `DISCARD_TAGS = new Set(['无法分类','未分类','其他','无','无标签'])` 与 `normalizeTags(tags)`（trim → 命中 DISCARD 即丢弃（大小写不敏感）→ 去空 → 去重 → 单标签截断 4 字 → 最多 3 个；过滤后为空保持 `[]`）；`ai.ts` 的 `generateMeta` 标签归一改走 `normalizeTags(rawTags)`；`META_PROMPT` 追加「若无法归类则返回 []，禁止返回「无法分类」类占位标签」。**`parseTags` 保持原行为不过滤**（避免 `cardDraftChanges` 对存量脏标签误判变更、打开即隐性清理，违反「存量不自动清理」）。
- **P0-2 选中标签强制首位**（`src/app/page.tsx` `handleCreate`）：`selectedTag && !isDemoView && selectedTag !== ''` 时 `finalTags = Array.from(new Set([selectedTag, ...aiTags])).slice(0, 3)`（选中标签强制首位，其余 AI 标签去重补充，最多 3 个）；否则维持原 AI 1~3 个；`handleCreate` 入参 `tags` 用 `finalTags`。
- **P0-3 去重提示**（`src/app/page.tsx` `handleCreate`）：提交前 `bodyNorm = normalizeBody(body.trim())`，与现有 `cards` 的 `normalizeBody(c.body.trim())` 全等比对（大小写敏感、空白归一后）；命中首个（`find`）`window.confirm('检测到内容已存在（标题「X」），是否仍要添加？')` → 取消 `return` 中断、确认继续建卡；`bodyNorm` 为空（空内容）不触发。

## 进行中 / 待办

- 本轮三项：P0-1 / P0-2 / P0-3（最高优先级）。
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

---

## 已收口（2026-08-27，P0-1/P0-2/P0-3 三项打包，待提交）

- 本轮 P0 用户反馈三项打包已交付并通过 QA 第七次与产品验收 PASS（2026-08-27），详见 `docs/progress/CURRENT_STAGE.md` 与 `docs/handoff/HANDOFF.md`。
- 实现：`DISCARD_TAGS` 5 脏标签+`normalizeTags`（大小写不敏感）于 `ai.ts` 归一、`META_PROMPT` 禁止占位（`parseTags` 不过滤）；`handleCreate` 筛选态 `selectedTag` 强制首位去重≤3；`normalizeBody` 全等比对 `confirm` 去重（空/不同不弹，首个仅一次）；自测 7 项逻辑+手测、tsc/lint 零错误。
- 下轮待排期：P0-4 网格直删（可配置确认）与 P0-5 高亮+亮色主题、P2-11/P2-3 等，见 `docs/review/PRODUCT_BACKLOG.md` 剩余候选池。
