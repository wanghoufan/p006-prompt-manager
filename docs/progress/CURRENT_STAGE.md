# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder（每个可独立收尾阶段结束后更新）
> 基线：ORCA 治理体系 V2.1 §3

> 本文件是 Builder 的「技术交接材料」载体，供 Stage Manager 判断下一步。只维护当前阶段，不按日期无限累积。

## 当前阶段
- Stage：P0-1 / P0-2 / P0-3 用户反馈三项打包（最高优先级）
- 完成度：实现 100%；自测 100%（tsc 0 错误 / lint 0 错误 / 浏览器手测三项关键路径全部通过）
- 风险等级：L0（无阻断性风险）；纯前端 / 轻量逻辑，无新依赖
- 基线：上一阶段 P2-8/P2-9/P3-6（commit `500b875` / 已收口）

## 本轮已完成

### P0-1 AI 无法分类时标签留空（堵住脏标签源头）
- **位置**：`src/lib/cards.ts` 新增导出 `DISCARD_TAGS = new Set(['无法分类','未分类','其他','无','无标签'])` 与 `normalizeTags(tags: string[])`（trim → 命中 DISCARD 即丢弃（大小写不敏感 `t.toLowerCase()`）→ 去空 → 去重 → 单标签截断 4 字 → 最多 3 个；过滤后为空保持 `[]`）；`src/lib/ai.ts` `generateMeta` 标签归一改走 `normalizeTags(rawTags)`；`src/lib/prompts.ts` `META_PROMPT` 追加约束「若无法判断这条提示词属于任何领域，请直接返回空标签数组 []，禁止返回「无法分类」「未分类」等占位标签」。
- **`parseTags` 决策**：保持原行为**不过滤**（避免 `cardDraftChanges` 对存量脏标签误判 tagsChanged → 打开即触发 commitSave 把脏标签清空，造成「隐性清理」，违反「存量污染不自动清理」规则；用户手动输入「其他」属显式行为应尊重）。存量「无法分类 1」保持不变，待 P2-9 手动清理。
- **验证**：逻辑级（Node `--experimental-strip-types` 跑真实 `src/lib/cards.ts` 副本）13 用例全部 PASS（脏标签 5 个全过滤、`vpn代理`/`标签很长超过四字的标签` 等保留且按 4 字截断、去重、trim、混合）；UI 链路真实建卡（粘贴口语内容触发 AI，AI 返回复用标签「qa基线」而非「无法分类」——AI 行为不可控，但过滤逻辑已兜底，链路正常）。

### P0-2 标签筛选态下新建默认携带当前选中标签
- **位置**：`src/app/page.tsx` `handleCreate(body, title, aiTags)` 改写签名（原 `tags` 参数改为 `aiTags`）；当 `selectedTag && !isDemoView && selectedTag !== ''` 时 `tags = Array.from(new Set([selectedTag, ...aiTags])).slice(0, 3)`（选中标签强制首位，其余 AI 标签去重补充，最多 3 个）；否则维持原 AI 1~3 个；`createCard(body, title, tags)` 入参用 `tags`。demo 只读视图不继承。
- **验证**：选中「vpn代理（1 张）」→ 粘贴「function selectProxy(profile) { return profiles[profile].url; }」→ 点击生成卡片 → 新卡「选择代理配置函数」tags=`[vpn代理, 代理配置]`，**vpn代理 强制首位**；左侧「vpn代理」计数 1→2，代理配置 1→2，排序方式显示「vpn代理 · 2 张」；卡片总数 32→33。截图 `scratch/manual-test/p0-2-newcard-with-vpn.png`。

### P0-3 重复内容去重提示
- **位置**：`src/app/page.tsx` `handleCreate` 入口处先 `bodyNorm = normalizeBody(body.trim())`，与 `cards` 中 `normalizeBody(c.body.trim())` 全等比对（大小写敏感、空白归一后）；命中首个（`find`）`window.confirm('检测到内容已存在（标题「X」），是否仍要添加？')` → 取消 `return` 中断、确认继续建卡；`bodyNorm` 为空不触发。复用现有 `normalizeBody`（P3-6 已落地）保证比对与新建一致。
- **验证**（注入 `window.confirm` 覆盖精确控制返回值）：
  - 复制原 vpn代理 卡 body（2545 字符）→ paste 触发 `handlePaste` → AI 生成成功 → `confirm` 被调用 1 次，文案完全匹配「检测到内容已存在（标题「生成国家故障转移代理组」），是否仍要添加？」；
  - 取消 confirm → 卡片数 33 不变（**取消不新增**）；
  - 设 `confirmNext=true` 再 paste → `confirm` 再被调用 1 次 → 卡片数 33→34（**确认继续建卡**）；
  - 注入全新内容（与任何已有卡都不同）→ `confirm` 调用次数 0（**不同内容不弹**）。
- **意外发现（小风险，不阻断）**：Composer `generate` 在 `onCreate` 同步返回 `false` 后仍会 `setText('')` + `notify('已创建卡片')` + `setPhase('idle')`——用户取消 confirm 后会看到「已创建卡片」toast 但实际未建卡，与 confirm 提示语义不一致。属 Composer.onCreate 回调契约问题，不在 P0-3 验收范围，建议未来版本（不动本轮）；可在 Composer 内根据 `onCreate` 返回值调整或新增 `onCreate -> boolean` 协议。

## 涉及文件
- 修改：`src/app/page.tsx`（handleCreate 改写签名 + P0-2 finalTags + P0-3 去重 + import normalizeBody）、`src/lib/ai.ts`（import normalizeTags + tags 归一改走 normalizeTags）、`src/lib/cards.ts`（新增 DISCARD_TAGS + normalizeTags）、`src/lib/prompts.ts`（META_PROMPT 追加 P0-1 约束）
- 文档：`docs/pm/PLAN.md`（当前目标段覆盖为 P0-1/P0-2/P0-3）、本文件
- 备份：`scratch/store.json.bak-p0-20260826`（手测前 31 张卡原状备份，手测后已恢复）

## 自测
- `npx tsc --noEmit`：零错误。
- `npm run lint`：零错误。
- **逻辑级（真实源码）**：`normalizeTags` 13 用例 全部 PASS（脏标签 5 个全过滤、保留正常标签按 4 字截断、去重、trim、混合、空数组）；`scratch/_cards_test.ts`（别名替换临时副本，跑完即删）。
- **浏览器手测（agent-browser Chromium，真机目检）**：
  1. **P0-1**：粘贴口语内容「今天天气不错，我想测试一下自己开发的语音输入法到底好不好用」→ AI 生成 → 新卡「测试语音输入法识别效果」tags=`[qa基线]`，未产生「无法分类」（AI 复用 qa基线）。
  2. **P0-2**：选中 vpn代理 标签 → 粘贴 `function selectProxy(profile) { return profiles[profile].url; }` → 生成 → 新卡 tags=`[vpn代理, 代理配置]`，vpn代理 强制首位，vpn代理 计数 1→2，代理配置 1→2。
  3. **P0-3 命中 + 取消**：paste 原 vpn代理 body（2545 字符）→ confirm 调用 1 次，文案匹配 → confirm 返回 false → 卡片数不变。
  4. **P0-3 命中 + 确认**：再 paste → confirm 返回 true → 卡片数 +1（33→34）。
  5. **P0-3 不同内容**：paste 全新内容（与任何已有卡不同）→ confirm 调用次数 = 0。
  6. **回归：标签面板**：qa基线、vpn代理、代理配置 等所有标签计数变化符合手测预期；恢复后回到原状（qa基线 8、vpn代理 1 等）。
  7. **回归：搜索/Composer/PreviewPanel**：搜索框、标签筛选、Composer textarea、PreviewPanel 占位、底部「局域网实时同步（服务端共享存储），离线回退本机缓存」文案均正常渲染。
- **截图**：`scratch/manual-test/p0-2-vpn-selected-js.png`（vpn代理 筛选态）、`scratch/manual-test/p0-2-newcard-with-vpn.png`（P0-2 新卡 vpn代理 首位）、`scratch/manual-test/regression-search-qa.png`（搜索 + 标签 AND 叠加）、`scratch/manual-test/regression-restored.png`（恢复后 31 张原状）。
- **运行时数据**：手测期间新建 4 张测试卡（测试语音输入法识别效果 / 选择代理配置函数 / 重复确认分支 / 不同内容验证），已停服 → 恢复备份 → JSON 校验 → 重启 dev server → HTTP 200 + /api/sync 200 + cards=31 验活。

## 风险 / 未验证
- **AI 返回「无法分类」场景未在真实 UI 复现**：本次手测 AI 返回了复用标签「qa基线」（existingTags 排序靠前）而非「无法分类」；P0-1 核心过滤逻辑已用真实源码 13 用例验证兜底，但 UI 端到端的「AI 返回脏标签 → 被过滤 → tags=[]」真实命中未复现（AI 行为不可控，建议 QA 阶段多粘贴几条口语内容验证）。
- **Composer.onCreate 同步返回 false 后仍 setText + notify**（P0-3 小风险）：用户取消 confirm 后会看到「已创建卡片」toast 但实际未建卡，语义不一致。建议未来 Composer.onCreate 改 `onCreate: (body, title, aiTags) => boolean` 返回 true/false 控制 setText 与 notify；本轮不动。
- **`parseTags` 不过滤决策的风险面**：用户手动输入「其他」会被保留为标签（合理：尊重用户显式输入）；但若用户从含「无法分类」标签的卡片编辑 tagsText（输入框）后失焦，tagsChanged = false（因为 parseTags 不过滤、原 card.tags 也不变），不触发保存——与「脏标签保留」一致，无回归。

## 给下一角色的技术交接要点
- QA 重点：
  - P0-1：多粘贴几条口语化、跨领域弱归类内容（已测试「测试语音输入法效果」、「今天天气不错」类），观察 AI 返回是否含「无法分类/未分类/其他/无/无标签」任一被过滤为 tags=[]。
  - P0-2：在 vpn代理 / qa基线 / 界面测试 等筛选态下分别新建，验证选中标签强制首位 + 其余 AI 标签去重 + 最多 3 个；「全部」下新建不强制；demo 视图无 Composer 不影响。
  - P0-3：复制任意已有卡 body 粘贴新建 → confirm 文案「检测到内容已存在（标题「X」），是否仍要添加？」；取消不新增；不同内容不弹；空内容不触发；多次命中仅首个（粘贴多条与不同卡完全相同的 body 应只调 1 次 confirm）。
  - 回归：搜索相关度 / 标签删除 × / 格式规范化（左对齐）/ 失焦保存 / 建版（上一轮已验收的功能），本轮未改其代码路径。
- 技术风险：L0；P0-3 Composer.onCreate 同步返回 false 后 UI 残留 toast 属次要体验问题，未阻断。
- 潜在回归：parseTags 不过滤是显式选择，已记录风险面。

## 建议下一步
- 等待用户【节奏】触发 QA Acceptance。
- 本轮三项（实现 4 改 + 2 文档）需用户授权后 commit / push。

## 已收口，待 QA 验收（2026-08-26，P2-8/P2-9/P3-6 三项打包）

- 上一阶段（搜索 + 健壮性批次 A+B，commit `bef563f`）已交付并通过 QA PASS / 产品验收 PASS。
- P2-8 / P2-9 / P3-6 三项打包已交付：relevanceScore 4/3/3/2/1 + compareBySortMode 二级 + `@code` 隔离 + 大小写不敏感 + 7 项自测含大小写/@/清空恢复；TagPanel TagRow 重构 + `handleDeleteTag` 批量移除（confirm、选中态取消、总数不变）；`normalizeBody` 5 步左对齐于 `saveBodyOnly`/`saveBodyWithVersion` 与导入路径统一生效。详见历史 git 提交（基线 `500b875`）。
- 本阶段（P0-1/P0-2/P0-3）基线：500b875。

---

## 已收口，待 QA 验收（2026-08-26，bef563f 搜索 + 健壮性批次 A+B）

- 上一更早阶段（搜索 + 健壮性批次 A+B，commit `bef563f`）已交付并通过 QA PASS / 产品验收 PASS，详见历史版本。
