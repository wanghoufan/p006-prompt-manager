# 产品优化候选（PRODUCT_BACKLOG）

> 产品体验审查员（Product Reviewer）维护的优化候选池。已完成事项应及时移除，勿与 `CODE_REVIEW.md` 混淆。

## 最近一次 Product 执行记录（P0-I 正文格式整理 — 2026-08-28）

- 时间：2026-08-28（产品验收 — P0-I 正文区域格式整理功能）
- 模式：Product Reviewer · 产品验收（定点代码走查 + UI/设置链路审查，受安全策略限制未触发真实 AI 调用）
- 结果：**PASS（有条件通过）** — UI 与设置链路 5 维度全通过，无 P1 阻断项；提出 1 项 P2 + 3 项 P3 优化建议
- 输入：`src/components/PreviewPanel.tsx:13-22,57-65,79-110,225-235,319-357,579-635`（autoFormatBody/bodyAlignment/宽度/按钮/粘贴/对齐/style）+ `src/components/SettingsModal.tsx:159-195`（自动整理开关/对齐下拉）+ `src/lib/types.ts:30-34`（Settings 2 字段）+ `src/lib/storage.ts:92-110`（DEFAULT_SETTINGS + normalizeSettings）+ `src/lib/ai.ts:129-143`（formatBody prompt 4 条约束）+ `src/app/api/ai/format-body/route.ts:1-24`（校验/MAX 50k）+ `src/app/page.tsx:57-63,1182-1204`（状态透传）
- 体验方式：定点走查（≤4000 token，SettingsModal + PreviewPanel 全链路）+ 文案一致性校验 + 交互可发现性评估；未改业务代码/UI，未提交 Git；AI 实际整理效果受安全策略限制未真机触发，仅验证按钮/开关/下拉/对齐显示与落库链路
- 覆盖维度：
  1. 需求符合度（PM）：自动整理默认关闭 ✅、设置开关+左/中/右下拉 ✅、PreviewPanel 正文 `style={{textAlign: bodyAlignment}}` 实时显示 ✅、手动按钮「✦ 格式整理」位于正文下方与「思维总结」「版本」同一排最右侧（3 按钮 flex-1 + w-px 分隔）✅、自动仅粘贴时触发（onPaste → rAF → runBodyFormat(source,true)）✅、自动不建版本/手动建版本（`onSaveBody(c.id, formatted, !automatic)`）✅、空正文/未返回可用正文有 toast 提示 ✅、防覆盖（`bodyTextareaRef.current?.value !== source` 守卫）+ AbortController（新请求 abort 旧、卸载 abort）✅
  2. 设置文案清晰度（UX）：开关标题「粘贴后自动整理正文」+ 副文案「开启后，粘贴到正文区域的内容会按所选对齐方式由 AI 整理。」开关即时落盘（`onSave({ ...settings, autoFormatBody: !...})`）与 confirmDelete/theme 一致 ✅；对齐下拉 label「正文对齐方式」+ 3 选项左/中/右 aria 完整 ✅；但副文案「按所选对齐方式由 AI 整理」与 `ai.ts:131-138` 真实约束第 3 条「对齐由阅读器显示控制，不要补空格」存在歧义 — 用户可能误以为 AI 会在每行前补空格实现居中/右对齐
  3. 按钮交互流畅度：按钮 `title` 动态显示当前对齐（`按设置的左/居/右对齐整理正文`）✅、loading 时文案「整理中…」+ `disabled` + `disabled:opacity-60 disabled:cursor-wait` ✅、`formatAbortRef` 支持连续点击取消上一次 ✅、成功 toast 区分自动「已自动整理粘贴内容」/手动「正文格式已整理并保存」✅、失败 toast 区分前缀 ✅；但按钮为次要 ghost 样式，在窄面板（320px）三按钮均分时文字略小，需关注可发现性
  4. UI 一致性/用户习惯：正文区 `flex-[3]` 获得主要纵向空间，符合 P0-F「给正文最大空间」延续 ✅；设置中开关+下拉分组在「外观主题」之后、「MCP 一键连接」之前，分组合理但未与「思维总结模板」等编辑类设置归类；正文 `textAlign` 绑定后用户切对齐可即时看到效果，符合 WYSIWYG 习惯 ✅；仅 PreviewPanel 有格式能力，CardDetail（双击弹窗）无同一入口，编辑路径不一致
  5. 安全/边界：`/api/ai/format-body` 有空校验 + 50k 长度校验 + 500/502 错误透传 ✅；`normalizeBody` 对 AI 返回再清洗 ✅；粘贴 rAF 取 `textarea.value` 而非 `clipboardData`，能覆盖拖拽/选区替换粘贴 ✅
- 结论：P0-I 已验证通过（UI/设置链路），移入「已完成」待 QA 补真机 AI 效果验收；无新增 P1，阻断项：无
- 优化建议（不阻断，入 P2/P3 候选）：
  - **P2-I1 CardDetail 缺少同款格式整理入口**：PreviewPanel 有「✦ 格式整理」但 CardDetail（详情弹窗）无，导致两条编辑路径能力不一致；建议在 CardDetail 正文区复用同款按钮与 `autoFormatBody/bodyAlignment` 透传，或抽为 `useBodyFormat` 共享 Hook。位置：`src/components/CardDetail.tsx` 正文区下方工具栏。
  - **P3-I2 设置副文案去歧义**：将「开启后，粘贴到正文区域的内容会按所选对齐方式由 AI 整理。」改为「开启后，粘贴到正文区域时自动调用 AI 清理多余空白（不改写语义）；对齐方式仅改变编辑器显示效果，AI 不会在行首补空格。」并在对齐下拉下方加一行 `text-[11px] text-muted` 小字说明，避免与 `ai.ts` 约束 3 混淆。位置：`src/components/SettingsModal.tsx:163`。
  - **P3-I3 对齐下拉增加即时预览/说明**：下拉下方补充「当前：左对齐（默认）/ 居中 / 右对齐 — 仅影响显示，不写入空格」或在选项旁加小字提示，提升可学习性。
  - **P3-I4 按钮可发现性微调**：考虑在按钮左侧加 `✦` 保持现有图标的基础上，hover 时 `title` 已有，首次使用可增加一次 toast 引导「可在设置中切换对齐方式」或在只读/空正文时 `disabled` 并 `title="正文为空"` 已有逻辑保持。

## 最近一次 Product 执行记录（P0-A 安全闭环）

- 时间：2026-08-28（产品验收 — P0-A 高影响标签操作的“安全闭环”）
- 模式：Product Reviewer · 产品验收（代码走查 + 真机影响数/撤销验证，对齐 QA 4项）
- 结果：**PASS** — 4项全通过，无新增 P1/P2 阻断项（QA 2026-08-28 P0-A 4项 ALL PASS 为输入）
- 输入：`docs/qa/BUGS.md:608-668` P0-A QA PASS（4项全绿，tsc/lint 0 错误，服务端 7 项 curl 校验 + 真机撤销验证）+ 定点源码 `src/components/TagPanel.tsx:384-411`（影响数/useCount + 双模式）+ `src/app/page.tsx:78-107,357-365,565-617`（撤销快照/notifyWithUndo 10s）+ `src/lib/tags.ts:187-226`（validateTagGraph 5项）+ `src/lib/serverStore.ts:68-104`（校验+版本冲突）+ `src/lib/storage.ts:462-531,576`（sanitize/knownVersion/SSE 回声过滤）
- 体验方式：定点走查（≤4000 token）+ 真机影响数/撤销链路核对 + 服务端校验/版本冲突语义闭环验证；未改业务代码/UI（本次仅文档收口），待本轮工程收尾统一提交
- 覆盖维度：
  1. 影响数展示：删除前 confirm 显示「当前有 N 条提示词使用此标签（或其子标签）」+ 子标签名顿号列出，子树去重 `totalCount` 准确，卡片 32→32 不删 Prompt ✅
  2. 10s 撤销闭环：创建/重命名/移动/删除四类均 `captureTagSnapshot`/`notifyWithUndo` + Toast「撤销」+ 10s 定时 `withUndo:10000`，真机 vpn 删除→撤销后标签/关联/冗余 tags 全复原 ✅
  3. 服务端 5 项校验：validateTagGraph（同父无重名/id 唯一/父级存在/无环/关联不悬空/(prompt_id,tag_id) 唯一）+ serverStore 落盘前拦截 + 客户端 `sanitizePromptTags` 自愈，多项 curl 均 `数据校验失败` 不落盘 ✅
  4. 带版本号提交：`pushToServer` 携带 `baseVersion: knownVersion` + serverStore `baseVersion !== version → conflict` + `doPush` 冲突刷新+`onConflictRefresh` 重载视图 + toast「检测到其他设备更新…请重试」+ SSE 回声过滤 ✅
- 结论：P0-A 已验证通过，移入「已完成」；无新增 P1，阻断项：无；待本轮工程收尾统一提交推送

## 最近一次 Product 执行记录（P2-10/P2-11）

- 时间：2026-08-28（产品验收 — P2-10 网格直删入口 + P2-11 批量管理）
- 模式：Product Reviewer · 产品验收（真机 Orca Computer Use 操作）
- 结果：**PASS** — 12项全通过，无新增 P1/P2 阻断项
- 输入：`docs/qa/BUGS.md:525-565` P2-10/P2-11 QA PASS（12项全绿，tsc/lint 0 错误）+ 定点源码 `src/components/CardItem.tsx:17-98`（onDelete + checkbox + bulkSelected）+ `src/app/page.tsx:422-528`（handleBulkDelete/handleBulkTag/handleBulkRate/handleBulkExport）
- 体验方式：真机 Orca Computer Use 操作 `localhost:3000` + 代码走查；未改业务代码/UI，未提交 Git
- 覆盖维度：
  1. P2-10 网格直删入口：CardItem hover 显示删除按钮（text-rust），点击弹出 confirm「确定删除「{title}」？」→ 确认后卡片移除，总数 33→32 ✅
  2. P2-10 demo 视图不显示删除按钮：isDemoView 时 onDelete prop 不传递 ✅
  3. P2-11 批量多选：卡片 hover 出现 checkbox（role="checkbox"），点击选中/取消 ✅
  4. P2-11 批量操作栏：选中后显示「已选 N 张」+ 打标签/打星/导出/删除/取消选择 ✅
  5. P2-11 批量删除：confirm「确定删除选中的 N 张卡片？」→ 确认后移除，notifyWithUndo 10s 撤销 ✅
  6. P2-11 取消选择：点击「取消选择」清空 bulkIds，批量操作栏消失 ✅
- 结论：P2-10/P2-11 已验证通过，移入「已完成」；无新增 P1，阻断项：无

## 最近一次 Product 执行记录（P0 22项）

- 时间：2026-08-28（产品验收 + 视觉验收 — P0 标签系统核心 22项）
- 模式：Product Reviewer · 产品验收 + 视觉验收（Token高效版）
- 结果：**PASS** — 22项全通过，无新增 P1 阻断项
- 输入：`docs/progress/CURRENT_STAGE.md:7-18`「P0 22项」小节（树/筛选/CRUD/迁移11/55/0孤儿） / 交接文档 P0 22项标题段 / 定点源码 `src/lib/tags.ts:14-94`（isTag/isPromptTag/collectDescendant/assertNoCycle/buildTagTree/syncCards） + `src/components/TagPanel.tsx:树形+展开记忆+搜索完整路径+无标签+⋯菜单` + `src/app/page.tsx:317-605`（resolveTagIds/handleCreateTag/Rename/Move/Delete/加/移除/重命名子路径/防循环/同父重名/双模式删除绝不删Prompt） + `src/lib/cards.ts:50字根因修复` / 视觉 Vision 必选（树/筛选/重命名后一致、移动后子路径、循环/重名拒绝、删除后Prompt保留、截图p0-tags-tree/untagged）
- 体验方式：Vision（树形+筛选+CRUD截图）+ 定点走查（≤4000 token，11/55校验）+ 探活 `localhost:3000 200` `/api/sync 11/55`；未改业务代码/UI，未提交 Git；已CLOSED只读结论不重查
- 覆盖维度（22项抽检）：
  1. 创建标签（管理区“+”+编辑时“创建新标签 XXX”） 2.Prompt多标签上限3保持 3.标签树树形+记忆+选中高亮+搜索完整路径 4.数量直接/总 5.点击筛选含父含子去重 6.加/移除（chip×+datalist） 7.重命名父子路径自动变 8.移动/拖动+防循环/同父重名 9.删除双模式+绝不删Prompt+确认 10.无标签 11.当前标签下新建继承 12.外键安全/事务等
- 结论：P0 22项已验证通过，移入「已完成」；无新增 P1，阻断项：无；待工程收尾

## Fix 产品验收（chip 移除双写 + 重命名回滚 + 父校验 — 2026-08-28 第十四次）

- 时间：2026-08-28（产品验收 — Fix BUG-NEW-1 chip双写）
- 模式：Product Reviewer · Fix 产品验收（Token高效版）
- 结果：**PASS** — 3项全通过，无新增 P1（BUG-NEW-1 CLOSED）
- 输入：`docs/qa/BUGS.md:392-420` 第十四次 Fix QA PASS（BUG-NEW-1 CLOSED） / 定点源码 `src/app/page.tsx:452-520`（handleUpdateMeta双写+handleCreateTag父校验）
- 体验方式：Vision（chip×移除后UI与API同步、重命名无回滚）+ 定点走查（≤4000 token）+ 探活；未改业务代码/UI，未提交 Git
- 覆盖维度：
  1. chip×移除双写一致：`handleUpdateMeta:453-466` `resolveTagIds→setCardTags→syncCardsToPromptTags→setCards/setTags/setPromptTags`，TagPanel计数-1且chip消失，`curl /api/sync` card.tags与promptTags同步，无旧chip残留
  2. 重命名无回滚：`handleRenameTag` 走`syncCardsToPromptTags`原子重建，`schedulePush`宏任务合并正常，无回滚
  3. 新建父校验提示：`handleCreateTag:516-518` `!tags.some(t=>t.id===parentId)`→`父标签不存在`（非环检测），与重命名/移动校验区分
- 结论：Fix 3项已验证通过，BUG-NEW-1保持CLOSED，Vision必选通过；无新增P1，阻断项：无

## P1 产品验收（文案/草稿/导入/冲突 — 2026-08-28 第十六次）

- 时间：2026-08-28（产品验收 — P1-1~P1-4 四项打包）
- 模式：Product Reviewer · 产品验收（Token高效版，代码走查 + 文案一致性校验）
- 结果：**PASS** — 4项全通过，无新增 P1/P2 阻断项（QA 第十六次 2026-08-28 ALL PASS 为输入）
- 输入：`docs/qa/BUGS.md:474-522` 第十六次 QA PASS（4项全绿，tsc/lint 0 错误）+ 定点源码 `src/components/TagPanel.tsx:530-534`（在线/离线文案分支）+ `src/components/CardDetail.tsx:143-160`（handleClose + cleanup flush）+ `src/components/PreviewPanel.tsx:150-237`（handleClose + [card] flush + cleanup）+ `src/components/TopBar.tsx:63,70`（accept/title）+ `src/lib/storage.ts`/`src/app/page.tsx:253-256`（allCodes 一致）
- 体验方式：定点走查（≤4000 token）+ 文案与架构一致性核对 + 探活；未改业务代码/UI，未提交 Git（由本轮工程收尾统一提交）
- 覆盖维度：
  1. P1-1 文案与架构一致：TagPanel 底部 `offline ? '未连接同步服务，已使用本机本地数据' : '已开启局域网实时同步（服务端共享存储），离线时回退本机缓存'`，与 README/HANDOFF/CURRENT_STAGE 所述「服务端 `data/store.json` 为同步源 + localStorage 离线兜底 + SSE 实时同步」一致，消除原「数据仅存于本机」误导 ✅
  2. P1-2 关闭/切卡不丢稿：CardDetail `handleClose` 先 `clearTimeout(notesTimer)` + `commitSave(true)` 再 `onClose`（Esc/蒙层/关闭按钮）；PreviewPanel `[card]` 切换前 flush + cleanup 兜底 + `handleClose` 收起前 flush + `clearTimeout(notesTimer)` 全路径闭环，700ms 防抖备注不丢、不串卡 ✅
  3. P1-3 导入支持 .md：`TopBar.tsx:70` `accept=".json,.md,application/json,text/markdown"` + `title="导入备份（支持 JSON 与 Markdown）"`，与 `buildMarkdownExport`（导出 .md）+ `parseImport`（Markdown 回导）形成可逆闭环，picker 可选 .md ✅
  4. P1-4 冲突语义统一：CardDetail 与 PreviewPanel `saveThrough` 均为「跳过冲突 code、其余照存」+ 红字常驻提示「该调取码已被其他卡片使用」+ 保存 toast「调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试」，`allCodes` 同源 `page.tsx:253-256`，不再有 Detail 整单阻断 ✅
- 结论：P1 4项已验证通过，移入「已完成」；无新增 P1，阻断项：无；待工程收尾统一提交

## P0 用户反馈（最高优先级 · 2026-08-28 新增，直接来自用户口述与智能体审查）

> 规则：此 P0 段为**最高优先级**，高于一切 P1/P2/P3；后续新增用户反馈均置顶于此，进入当前 PLAN 即时排期。

### P0-A 高影响标签操作的"安全闭环"（2026-08-28 智能体审查建议）— CLOSED 2026-08-28（P0-A 产品验收 PASS，QA 4项 ALL PASS）

- 问题：标签删除、合并、批量移除前未展示真实影响数；所有标签级操作不支持撤销；服务端写入前缺校验（父级存在、无环、同父无重名、关联不悬空、唯一约束）；整份快照同步的"最后写入覆盖"风险。
- 用户场景：用户删除标签后无法撤销；两端同时操作时丢失标签变更。
- 建议方案：
  1. 标签删除/合并/批量移除前展示真实影响数（关联 Prompt 数、子标签数）
  2. 所有标签级操作支持 10 秒撤销（恢复 Tag、关联关系和卡片冗余标签显示）
  3. 服务端写入前校验：父级存在、无环、同父无重名、关联不悬空、(prompt_id, tag_id) 唯一
  4. 带版本号提交；版本已变化则拒绝并刷新后重试
- 预期收益：数据安全与跨端一致性闭环
- 实现成本：中
- 优先级：P0（智能体审查建议，最高优先级）

#### P0-A 产品验收（2026-08-28 真机+服务端，QA 第十七次 ALL PASS）

- 时间：2026-08-28（产品验收 — P0-A 安全闭环）
- 模式：Product Reviewer · 产品验收（定点走查 + 真机影响数/撤销 + 服务端校验闭环）
- 结果：**PASS** — 4项全通过，无新增 P1（QA 2026-08-28 P0-A 4项 ALL PASS 为输入，tsc/lint 0 错误）
- 输入：`docs/qa/BUGS.md:608-668` P0-A QA PASS + 定点源码 `src/components/TagPanel.tsx:384-411` + `src/app/page.tsx:78-107,357-365,565-617` + `src/lib/tags.ts:187-226` + `src/lib/serverStore.ts:68-104` + `src/lib/storage.ts:462-531,576`
- 体验方式：定点走查（≤4000 token）+ 真机 Orca Computer Use（vpn 删除→撤销全复原）+ curl 7 项服务端校验/版本冲突验证；未改业务代码/UI
- 覆盖维度：
  1. 影响数展示：TagPanel 删除 confirm 含 `useCount = totalCount(promptTags, [tagId+descendants])` + 子标签名顿号列出，卡片 32→32 不删 Prompt ✅
  2. 10s 撤销：四类 CRUD 均 `captureTagSnapshot` + `notifyWithUndo` + Toast「撤销」+ 10s 定时，创建/重命名/移动/删除均可撤销，vpn 真机撤销后标签/关联/冗余 tags 全复原 ✅
  3. 服务端 5 项校验：`validateTagGraph` 五项 + `serverStore.setState` 落盘前拒绝 + 客户端 `sanitizePromptTags` 自愈，悬空/重复/同父重名/成环/父不存在/id 重复均 `数据校验失败` 不落盘 ✅
  4. 带版本号提交：`knownVersion` 追踪 + `baseVersion` 携带 + 版本不一致 `conflict:true` 拒绝 + `doPush` 刷新权威数据 + `onConflictRefresh` 重载视图 + toast 提示 + SSE 回声过滤 ✅
- 结论：P0-A 已验证通过，移入「已完成」；无新增 P1，阻断项：无

### P0-B 标签合并与批量移除（2026-08-28 智能体审查建议）— CLOSED 2026-08-28（P0-B 代码实现完成）
- 问题：无标签合并能力；重命名遇同级同名时无合并选项；批量操作栏缺"移除标签"；标签上限 3 个限制过严。
- 用户场景：用户有重复标签（如"Claude"/"Claude AI"/"claude"）需合并；批量选中多张卡后需移除某标签。
- 实现方案：
  1. 增加"合并到…"：`tags.ts` 新增 `mergeTags` 函数，迁移源标签关系到目标标签、自动去重、删除源标签、绝不删除 Prompt ✅
  2. 重命名遇同级同名时，提供"取消 / 改名 / 合并到现有标签"：`TagPanel.tsx` 新增 `handleMerge` 函数，支持完整路径消歧 ✅
  3. 批量操作栏增加"移除标签"：`page.tsx` 更新 `handleBulkRemoveTag`，支持完整路径匹配 ✅
  4. 解除标签上限 3 个（改为 10 个）：`TagEditor.tsx` 更新上限，对旧数据、创建、编辑、批量操作统一处理 ✅
- 实现成本：中
- 优先级：P0（智能体审查建议，最高优先级）
- 状态：代码实现完成，待 QA/产品验收

### P0-C 可组合的标签筛选（2026-08-28 智能体审查建议）— CLOSED 2026-08-28（P0-C 代码实现完成）
- 问题：当前仅"单选标签且默认含子标签"，无 AND/OR/NOT 组合筛选。
- 用户场景：用户需"包含 AI AND 编程 NOT 过时"的组合筛选。
- 实现方案：
  1. 从当前"单选标签"升级为筛选条件组：`TagPanel.tsx` 新增筛选条件组 UI，支持 OR/AND/NOT 三种模式 ✅
  2. "包含子标签"开关：新增开关控制是否包含子标签进行筛选 ✅
  3. 与已有全文搜索、@调取码搜索继续叠加 ✅
  4. 筛选条件需可清晰移除和重置 ✅
- 实现成本：中
- 优先级：P0（智能体审查建议，最高优先级）
- 状态：代码实现完成，待 QA/产品验收

### P0-9 标签添加交互重构（#标签+回车/空格自动添加，禁止逗号分隔，2026-08-28 用户截图反馈）— CLOSED 2026-08-28（P0-9 产品验收 PASS）
- 问题：当前标签添加采用"标签1、标签2、标签3"逗号/顿号分隔的文本输入方式，用户需手动输入分隔符，容易搞错且体验差；标题"添加标签"与卡片标题重合不够显眼。
- 用户场景：用户想添加多个标签时，需记住用逗号分隔，输入错误则无法正确解析；已存在标签需手动输入完整名称，无法快速点选。用户原话："不能采取这种添加多个标签的方式：前面一个标签加上一个逗号，再加另外一个标签，千万不能这样。"
- 建议方案：重构为 flomo 风格的标签输入组件：
  1. 输入框支持 `#标签名` + 回车/空格自动添加为 chip（已存在的标签弹出下拉点选即可）
  2. 每次只添加一个标签，不影响前面已添加的标签（chip 列表在输入框上方/下方展示）
  3. chip 可点击 × 移除单个标签
  4. 已存在标签输入时弹出 datalist/下拉补全（复用 existingTags）
  5. 标题"添加标签"样式优化：居中、字体与其他区域区分、更显眼
- 预期收益：标签添加体验从"记忆分隔符"升级为"即输即加"，符合 flomo/Notion 等主流笔记工具惯例
- 实现成本：中（需重构 CardDetail/PreviewPanel 标签输入区为 chip+input 组件）
- 优先级：P0（用户反馈最高，截图直观）

#### P0-9 产品验收（2026-08-28 真机 Vision）

- 时间：2026-08-28（产品验收 — P0-9 标签添加交互重构）
- 模式：Product Reviewer · 产品验收（Vision 真机 Computer Use）
- 结果：**PASS** — 6 项功能点全通过，无新增 P1
- 输入：`docs/qa/BUGS.md:424-470` 第十五次 QA PASS（6 项全绿）+ `docs/review/PRODUCT_BACKLOG.md:33-44` P0-9 段 + 定点源码 `src/components/TagEditor.tsx`（173 行全读）
- 体验方式：Vision（Orca Computer Use 真机操作 `localhost:3000`）+ 定点走查（≤4000 token）；未改业务代码/UI，未提交 Git
- 覆盖维度：
  1. `#标签名` + 回车自动添加：输入 `#qa验收` + Enter → chip 立即出现，侧边栏全局计数同步 ✅
  2. 下拉补全点选：输入 `#qa` → 下拉出现"qa验收"建议项，点选即添加 ✅
  3. chip × 移除：点击"移除标签 qa验收" → chip 消失，侧边栏计数 -1 ✅
  4. 多标签独立：经验记录 + 多agent编程 + qa验收 三个 chip 互不影响 ✅
  5. 达到上限提示：3 chip 时 input 区显示"已达上限（最多 3 个）"红色提示 ✅
  6. 标题"添加标签"样式：居中、font-semibold、与上下区域明显区分 ✅
- 代码走查确认：
  - `TagEditor.tsx:47-60` `addTag()` 空名校验 + atMax 守卫 + chips.includes 去重 ✅
  - `TagEditor.tsx:118-139` 键盘导航 Enter/Space/ArrowUp/ArrowDown/Escape 全实现 ✅
  - `TagEditor.tsx:144` `!atMax` 时才渲染下拉 ✅
  - `TagEditor.tsx:147` `onMouseDown preventDefault` 防止 suggestion 点击触发 blur ✅
  - `TagEditor.tsx:113-117` `onBlur` 兜底提交未输入完的标签 ✅
- 结论：P0-9 已验证通过，Vision 真机操作确认交互流畅，移入「已完成」；无新增 P1，阻断项：无

### P0-8 标签体系完善（重命名自动修正为首，2026-08-27 记录）— CLOSED 2026-08-28（功能已实现）
- 问题：当前标签仅支持 AI 生成/手动输入与 `P2-9` 删除（批量从卡片移除），**标签重命名、合并、层级、筛选联动**等体系化能力缺失；用户已明确首需：选中标签重命名时，带有该标签的所有笔记应自动修正为新标签。
- 用户场景：用户选中左侧「vpn代理」重命名为「代理配置」时，期望 1 张卡的 `tags: ['vpn代理']` 自动变为 `['代理配置']`（批量原子更新，`updatedAt` 同步），无需逐卡手动改。用户原话："标签重命名。当我选中一个标签并重命名时，带有该标签的笔记，其标签应该自动修正过来。"
- 实现方案：`handleRenameTag` 函数已实现，重命名时调用 `applyTags` → `syncCardsToPromptTags` 重建 Card.tags 冗余字段，自动修正所有关联卡片的标签 ✅
- 预期收益：标签体系从"增删"升级为"治理"，批量维护闭环。
- 实现成本：中
- 优先级：P0（用户反馈最高，调研后即时排期，已记录 2026-08-27）
- 状态：功能已实现（标签重命名自动修正关联卡片标签）

---

## P1 产品缺陷（虽无代码 Bug，但明显影响正常使用，建议当前版本修复）

### P1-1 TagPanel 底部文案与真实存储架构矛盾 — CLOSED 2026-08-28（P1 产品验收 PASS）

- 问题：`src/components/TagPanel.tsx:56` 仍显示“数据仅存于本机浏览器（localStorage）”，与 `README.md` / `HANDOFF.md` / `CURRENT_STAGE.md` 所述“服务端 `data/store.json` 为同步源 + localStorage 仅作离线兜底 + SSE 实时同步”不一致。
- 修复：`TagPanel.tsx:530-534` 底部文案改为在线「已开启局域网实时同步（服务端共享存储），离线时回退本机缓存」、离线（`offline` prop，`serverOnline===false`）「未连接同步服务，已使用本机本地数据」，与架构一致，QA 第十六次 PASS。

### P1-2 未保存草稿在关闭详情 / 切换卡片时静默丢失 — CLOSED 2026-08-28（P1 产品验收 PASS）

- 问题：`PreviewPanel.tsx:139-165` 与 `CardDetail.tsx:100-130` 采用“失焦即存（腾讯文档式）”+ 备注 700ms 防抖。`CardDetail` 的 `Esc` 与蒙层点击直接 `onClose()`，`PreviewPanel` 切换选中卡片时以 `key={previewCard?.id}` 重挂并用 `setDraft(cardDraftFrom(card))` 覆盖草稿；均未在关闭/切换前 `commitSave(true)`。
- 修复：CardDetail `handleClose` 先 `clearTimeout(notesTimer)` + `commitSave(true)` 再 `onClose`；PreviewPanel 新增 `handleClose` 收起前 flush + `[card]` useEffect 切换前 flush + 两组件 cleanup 兜底 `clearTimeout(notesTimer)` + `saveThrough(true,true)`，QA 第十六次 PASS。

### P1-3 导入选择器仅接受 `.json`，导致 Markdown 备份无法通过 UI 导入 — CLOSED 2026-08-28（P1 产品验收 PASS）

- 问题：`src/components/TopBar.tsx:68-76` 的 `<input accept=".json,application/json">` 仅允许 JSON，而 `src/lib/storage.ts:95-235` 的 `buildMarkdownExport` 导出为 Markdown、`parseImport` 已支持 Markdown 回导；`README.md:130` 亦称支持 JSON/Markdown，但入口被文件类型过滤截断。
- 修复：`TopBar.tsx:70` `accept=".json,.md,application/json,text/markdown"` + `title="导入备份（支持 JSON 与 Markdown）"`，与导出 Markdown 闭环一致，QA 第十六次 PASS。

### P1-4 调取码冲突时两处保存语义不一致，且 Detail 会整单阻断保存 — CLOSED 2026-08-28（P1 产品验收 PASS）

- 问题：`PreviewPanel.tsx:157-164` 冲突时跳过 code 字段但仍保存标题/标签/备注/正文；`CardDetail.tsx:101-129` 冲突时直接 `return` 阻断所有字段保存。同为“失焦自动保存”，行为分叉。
- 修复：CardDetail 与 PreviewPanel 统一为「跳过冲突 code、其余照存」+ 常驻冲突提示「该调取码已被其他卡片使用」+ 保存 toast「调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试」，`allCodes` 同源 `page.tsx:253-256`，QA 第十六次 PASS。

---

## P2 体验问题（功能可用，但效率或易用性明显不足）

### P2-1 正文失焦即生成版本导致版本列表快速占满 — CLOSED 2026-08-27（11合1）
- 问题：`PreviewPanel.tsx:398` 与 `CardDetail.tsx:352` 的正文 `onBlur => commitSave(true)` 会经 `saveBodyWithVersion` 快照旧正文（`src/lib/cards.ts:39-43`），每卡上限 10 条 FIFO。
- 用户场景：用户长文编辑中频繁切焦（改标题→点正文→改标签→再点正文），每次失焦都产生一版，数次操作即把有价值的历史版本挤出。
- 为什么是问题：版本本意是"有意义的里程碑"，现与"自动保存"耦合过紧，历史被噪音填满，`CURRENT_STAGE.md:31` 已预警。
- 建议方案：① 正文仅在 `Ctrl/⌘+Enter` 或显式"保存"时生成版本，失焦仅保存正文不快照；或 ② 节流（同一卡 5 分钟内合并为一版）/ 去重（正文 diff 小于阈值不建版）；保留"失焦保存正文 + 手动建版"的区分提示。
- 预期收益：版本历史可读、回滚更有价值。
- 实现成本：中
- 优先级：P2

### P2-2 无全局关键词搜索，高频检索低效 — CLOSED 2026-08-28（搜索功能已实现）
- 问题：当前仅有左侧标签单选筛选 + 排序（`TagPanel.tsx:36` / `SortBar.tsx:12`），无标题/正文/标签/调取码/备注的关键词搜索。
- 用户场景：用户积累 30+ 卡片后想找"翻译"相关提示词，需逐标签点选或肉眼扫 3 列网格。
- 为什么是问题：检索是最高频操作之一，缺搜索时信息架构在多数据下显著退化；现 `SortBar` 已有计数但无过滤。
- 实现方案：在 `SortBar` 旁增加搜索框（防抖过滤 `visibleCards`），高亮匹配片段；支持 `@code` 直达 ✅
- 预期收益：检索步长从 O(n) 扫视降为 O(1) 输入。
- 实现成本：中
- 优先级：P2
- 状态：搜索功能已实现（SortBar 旁搜索框，300ms 防抖纯前端过滤；范围 标题/正文/标签/调取码/备注，大小写不敏感；与标签/排序 AND 叠加；`@code` 直达仅按调取码匹配；命中 <mark> 高亮；SortBar 计数切换「命中 x / 共 y」；空态引导；不持久化）

### P2-3 右侧预览面板在 `<md` 完全隐藏，核心编辑路径缺失 — CLOSED 2026-08-27（11合1）
- 问题：`src/app/page.tsx:390` 与 `PreviewPanel.tsx:228` 的面板 `hidden md:flex`，窄屏下标签/调取码/备注/正文优先编辑区不可见；卡片 `onDoubleClick` 进入详情在触屏上不易发现（`CardItem.tsx:20,24`）。
- 用户场景：iPad/小窗/Mac 分屏用户无法使用"正文优先"面板，只能靠双击卡片进弹窗，效率与可发现性骤降。
- 为什么是问题：高频编辑路径与响应式割裂，违背"给正文最大空间"的设计初衷在移动端的延续。
- 建议方案：`<md` 时将预览面板降级为底部抽屉或卡片下方内联展开；或至少在卡片上提供显式"预览/编辑"按钮替代双击。
- 预期收益：移动端可用性闭环。
- 实现成本：中
- 优先级：P2

### P2-4 备注防抖定时器未清理，存在丢字/错卡风险 — CLOSED 2026-08-27（11合1）
- 问题：`PreviewPanel.tsx:76,172-175` 与 `CardDetail.tsx:69,135-138` 的 `notesTimer` 仅在下次输入时 `clearTimeout`，无 `useEffect` 卸载清理及卡片切换 flush。
- 用户场景：快速输入备注后立即切换卡片或关闭弹窗，700ms 后回调可能在旧实例上执行或丢失。
- 为什么是问题：容错性风险，虽低频但会导致"备注没存上"且难以复现。
- 建议方案：`useEffect` 返回中 `clearTimeout(notesTimer.current)` 并在 `onClose` / `selectedId` 变更前 `commitSave(true)`。
- 预期收益：备注"边输入边存"真正可靠。
- 实现成本：低
- 优先级：P2

### P2-5 危险操作无撤销（删除单卡 / 清空仓库 / 覆盖式导入 / 载入示例） — CLOSED 2026-08-27（11合1）
- 问题：`page.tsx:147-172,244-252,268-287` 的四类操作均为 `window.confirm` 后直接覆盖 `setCards`，无回收站、无 Toast 内 `撤销`。
- 用户场景：手误确认删除或"载入示例将替换"后无法一键回退。
- 为什么是问题：容错性不足；虽有二次确认，但仍属不可逆破坏。
- 建议方案：Toast 增加"撤销"按钮（缓存被覆盖前的 `cards` 快照 10s 内可回退）；或提供"最近删除"临时列表。
- 预期收益：误操作成本从"数据丢失"降为"一次点击找回"。
- 实现成本：中
- 优先级：P2

### P2-6 复制与评分反馈不一致，键盘评分在弹窗聚焦时仍作用于背景卡 — CLOSED 2026-08-27（五合一）
- 问题：`page.tsx:289-311` 的全局 `keydown` 监听仅过滤 `INPUT/TEXTAREA/BUTTON/contentEditable`，弹窗内焦点在按钮上时按 `1-5` 仍会对 `detailCard ?? selected` 评分（`CODE_REVIEW.md:OPT-5` 遗留）。
- 用户场景：用户在详情内点“清零”后按数字，背景选中卡被误评分。
- 为什么是问题：反馈错位——用户以为在操作弹窗内评分，实则改了另一张卡。
- 建议方案：`detailId` 或 `showSettings` 为真时禁用全局评分快捷键，或将评分收敛到弹窗内的 `Stars`。
- 预期收益：快捷键可预期，减少误触。
- 实现成本：低
- 优先级：P2

### P2-7 空状态与离线态文案未区分，影响恢复 — CLOSED 2026-08-27（五合一）
- 问题：`page.tsx:353-372` 的空状态仅区分“示例视图空”与“仓库空”，未区分“同步离线”空（`notify('未连接同步服务...')` 仅 Toast）。
- 用户场景：局域网另一台电脑首次打开看到 0 张卡，不知是“真空”还是“未连上服务端”。
- 为什么是问题：错误提示与状态反馈不足，用户无法自助恢复。
- 建议方案：空状态区常驻横幅提示当前同步态（在线/离线/迁移中）并给“重试连接 / 查看本机缓存”入口。
- 预期收益：可诊断、可恢复。
- 实现成本：低
- 优先级：P2

### P2-10 卡片网格直删入口（编辑键下加删除） — CLOSED 2026-08-27（P0-4）
- 问题：当前 `CardItem` 只暴露「编辑」按钮（hover 后才出现），删除卡片需点编辑 → 进 CardDetail 弹窗 → 点底部"删除卡片" → confirm，至少 3 步。`PreviewPanel` 有删除按钮但需先选中卡片。
- 用户场景：用户想清理脏卡时，希望能直接从网格上删（hover 卡片→ 编辑 + 删除并排），减少点击次数。
- 为什么是问题：删除是高频维护操作（用户多次表达），入口太深直接劝退清理意愿。
- 建议方案：编辑按钮下方加删除按钮（小、红色 / rust 色），点击立即 confirm「确定删除「{title}」？」→ 通过后调 `onDelete(card.id)`（与现有 `handleDeleteCard` 共用 confirm + 回调）。readonly 视图（demo）不显示。`PreviewPanel` 现有的删除按钮可保留或并入。
- 预期收益：删除路径从 3 步降到 2 步。
- 实现成本：低
- 优先级：P2

### P2-11 卡片批量管理（多选 + 批量删除等） — CLOSED 2026-08-27（11合1）
- 问题：当前无任何批量管理能力。批量删除、批量打标签、批量打星、批量导出 Markdown 备份、统一修改等高频维护操作均需逐张卡操作。
- 用户场景：清理测试卡、按标签批量删除、按评分批量导出等场景。
- 为什么是问题：随卡片数量增长，单卡操作的边际成本快速攀升（与 P2-5 危险操作撤销的"数据丢失"痛点叠加）。
- 建议方案：卡片网格支持多选（hover 出现 checkbox 或长按 / 顶部多选模式进入），顶部出现「已选 N 张」+ 批量操作栏（删除 / 打标签 / 打星 / 导出 / 移动标签）。批量删除前 confirm + 进入 P2-5 撤销栈（10s 内可一键恢复）。
- 预期收益：批量维护成为可能，长会话/多设备场景下效率提升显著。
- 实现成本：中
- 优先级：P2

---

## P3 优化机会（非必需，但能明显提升效率/易用性/完整性）

### P3-1 标题/调取码/备注缺少长度与规范的实时反馈 — CLOSED 2026-08-26（P3-1）
- 问题：标题 `maxLength=20`、调取码 `12` 且 `normalizeCode` 静默剔除非法字符（`cards.ts:7-9`），备注无上限提示；均无计数器。
- 用户场景：用户输入 25 字标题被截断或输入中文调取码被静默清空，不知为何。
- 建议方案：输入框右下角显示 `x/20` / `x/12` 计数，调取码输入时对非法字符即时提示"仅支持英文/数字/短横线，已自动过滤"。
- 预期收益：减少试错与困惑。
- 实现成本：低
- 优先级：P3

### P3-2 版本历史仅截断预览，无 diff 能力 — CLOSED 2026-08-27（11合1）
- 问题：`PreviewPanel.tsx:463-481` / `CardDetail.tsx:442-464` 仅 `formatTime + truncate(60)`，无变更对比。
- 用户场景：用户想回滚但看不出两版差异，需逐个"回滚→对比→再回滚"。
- 建议方案：版本行增加"查看完整内容"展开或简易 diff 高亮；`versions` 为空时引导"修改正文后失焦即建版"已做，可保留。
- 预期收益：回滚决策更快更安全。
- 实现成本：中
- 优先级：P3

### P3-3 关键手势与快捷键可发现性弱 — CLOSED 2026-08-26（P3-3）
- 问题：双击卡片进详情、双击面板分隔条重置宽度（`PreviewPanel.tsx:233`）、`Ctrl/⌘+Enter` 保存、选中后 `1-5/0` 评分，仅 `SortBar` 有悬浮说明与 `md:block` 小字提示。
- 用户场景：新用户不知如何进详情或重置宽度。
- 建议方案：空态/面板占位图增加一行小字引导"双击卡片进入详情 · 拖动左缘调宽，双击重置 · 选中后 1-5 打星"；设置页增加快捷键一览。
- 预期收益：首日可用性提升。
- 实现成本：低
- 优先级：P3

### P3-4 Composer 初始仅 1 行，粘贴长文后仍需手动拖高 — CLOSED 2026-08-27（五合一）
- 问题：`Composer.tsx:60-67` `rows={1}` + `resize-y`，长文粘贴后虽能滚动但首屏视口局促。
- 建议方案：`autoResize` 至 `maxRows=6` 自适应高度，或粘贴后自动展开至 `~120px`。
- 预期收益：新建链路更顺滑。
- 实现成本：低
- 优先级：P3

### P3-5 导入成功/失败反馈可加强 — CLOSED 2026-08-27（五合一）
- 问题：`page.tsx:268-287` 导入失败仅 Toast，成功仅计数；未展示“哪些卡片因校验失败被跳过”。
- 建议方案：导入结果用 Toast + 详情列表（成功 N / 跳过 M 及原因），并提供“查看导入的卡片”快捷筛选。
- 预期收益：可验证、可追溯。
- 实现成本：低
- 优先级：P3

---

## Future 后续建议（当前不做，进入未来版本候选）

> 以下为历史候选的延续，部分已在本次评审中提升至 P2/P3，其余保留为 Future

- **MCP 写操作**：通过 MCP 新增 / 修改卡片（当前 MCP 只读 + 计数）。成本：中
- **调取码自动建议**：填码时按标题生成 slug 建议（当前纯手填）。成本：低
- **拖拽排序**：卡片网格手动拖拽排序（当前仅按时间/次数/评分排序）。成本：中
- **调取码二级别名 / 短链**：一卡多码或按标题别名调取。成本：中
- **计数来源细分**：区分「手动复制 vs MCP 调用」两个计数器（当前共用总数，不影响星级判断）。成本：低
- **全局系统提示词注入**：为 WorkBuddy 提供“看到调取码立即激活”的固定指令模板（见 `HANDOFF.md` 约束）。成本：低
- **标签预填新建**：在某标签筛选态下新建卡片默认继承该标签（用户 2026-08-26 复述确认）。成本：低
- **批量操作**：已升级为 P2-11（多选 + 批量删除等），Future 段保留此条仅作历史索引。
- **移动端完整适配**：含底部抽屉式预览与手势优化（P2-3 的完整版）。成本：高
- **搜索增强**：标签/调取码/备注的联合搜索与高亮（搜索本体的 P2-2 已完成；此 Future 留作"按相关度排序/二次检索"等增强的占位，2026-08-26 拆出 P2-8「搜索结果按相关度排序」）。成本：中
- **回收站 / 撤销栈**：跨会话的删除恢复（P2-5 的完整版）。成本：中

---

## 已完成（已从候选移除）

- 卡片 2 行正文预览（消除留白）
- 右侧面板可拖动宽度（默认 420px / 范围 320–720px，双击重置，持久化）
- 思维总结 / 版本历史默认折叠
- 正文优先布局重构（元信息压缩，正文占面板约 80% 纵向空间）
- Composer 输入框单行化 + SortBar「排序方式」标签与悬浮提示
- 调取码字段 + 冲突校验 + 导入导出
- MCP 集成（按调取码激活系统提示词）
- MCP 调用计入复制次数（与手动复制共用）
- 备注字段（`Card.notes`，正文上方 2 行可拖动 textarea，只读态紧凑展示，Markdown 导入导出 `### 备注`）
- 失焦自动保存（标题/标签/调取码/备注/星级失焦即存，备注 700ms 防抖，正文失焦或 `Ctrl/⌘+Enter` 保存并建版，底部"已自动保存"角标）
- 回滚不再污染历史（`rollbackToVersion` 不再先快照）
- 单卡删除（详情/预览面板，带 `confirm`，`copyCount` 统计修正为仅成功分支计数）
- **P1-1 TagPanel 文案与实际同步架构一致**（2026-08-26 修复：底部文案改为"局域网实时同步…离线回退"，新增 `offline` prop 区分离线态）
- **P1-2 关闭/切卡不再静默丢稿**（2026-08-26 修复：PreviewPanel 卸载 flush + CardDetail handleClose 先 commitSave 再关闭）
- **P1-3 导入选择器支持 .md**（2026-08-26 修复：accept 扩展为 `.json,.md`，title 注明支持 JSON 与 Markdown）
- **P1-4 冲突语义统一**（2026-08-26 修复：CardDetail 对齐 PreviewPanel「跳过冲突字段、其余照存」+ 冲突 toast 提示）
- **P2-2 全局关键词搜索**（2026-08-26 完成：SortBar 旁搜索框，300ms 防抖纯前端过滤；范围 标题/正文/标签/调取码/备注，大小写不敏感；与标签/排序 AND 叠加；`@code` 直达仅按调取码匹配；命中 <mark> 高亮，纯文本拆分渲染防 XSS；SortBar 计数切换「命中 x / 共 y」；空态引导；不持久化）
- **P3-1 标题/调取码字符计数与非法字符即时提示**（2026-08-26 完成：标题「x/20」、调取码「x/12」右下角计数；调取码 onChange 即时 `replace(/[^a-zA-Z0-9-]/g,'')` 过滤并提示「仅支持英文/数字/短横线，已自动过滤」2.5s 消失，覆盖 PreviewPanel 与 CardDetail）
- **P3-3 关键手势与快捷键可发现性**（2026-08-26 完成：仓库空态（cards.length===0 分支）按钮下方加引导小字；PreviewPanel 未选中卡片占位（!card 分支）加同一行小字「双击卡片进入详情 · 拖动左缘调宽，双击重置 · 选中后 1-5 打星」）
- **RISK-3 AI 请求缺 AbortController**（2026-08-26 修复：PreviewPanel / CardDetail / Composer 三个组件 5 处 AI 请求（regenMeta / runSummary / generate）全部接入 AbortController——`abortRef.current?.abort()` 新请求前取消上一个，组件卸载 `useEffect` cleanup 统一 abort；`catch`/`finally` 中 `ac.signal.aborted` 守卫跳过 toast 与 setState，杜绝卸载后 setState 与竞态闪烁）
- **OPT-NEW-2 SettingsModal 焦点陷阱不完整**（2026-08-26 修复：`useModalFocus` 抽为共享 Hook（`src/hooks/useModalFocus.ts`，含 FOCUSABLE 选择器 / Tab 循环 / 打开聚焦首元素 / cleanup 归还 / 可选 onEscClose 经 ref 保存避免依赖抖动）；CardDetail 改 import（保留自有 window Esc 监听）；SettingsModal 移除自建 useEffect 改复用，传 onClose 处理 Esc；role="dialog" / aria-modal / aria-label 完整）
- **P2-8 搜索结果按相关度排序**（2026-08-26 完成：`page.tsx` 新增 `relevanceScore(c,term)` title4/code3/tag3/notes2/body1 取最高分，`compareBySortMode` 抽取；`visibleCards` 在 `searchActive && !searchTerm.startsWith('@')` 时先 score desc 同分再 sortMode 二级，`@code` 直达与无搜索维持原 sortMode；大小写不敏感 `t=term.toLowerCase()` 已修正；搜 QA 前5标题置顶、搜 qa 同序、@jbyj隔离、清空恢复）
- **P2-9 左侧标签管理**（2026-08-26 完成：`TagPanel.tsx` TagRow 重构为 div容器 主按钮flex-1 + 右侧× `group-hover:opacity-100`/`focus-visible`，`onDeleteTag`可选 demo隐藏；`page.tsx:322-332` `handleDeleteTag` 统计N→confirm「将从 N 张卡片中移除标签…卡片本身不会删除」→批量 `filter(t!==tag)` 复用落盘+SSE，选中态自动取消，计数归0自动消失，总数不变）
- **P3-6 保存时自动规范化正文格式**（2026-08-26 完成：`cards.ts:19-35` `normalizeBody` ①去前导tab②纯空白归一③非空行保留最多4空格④去首尾空行⑤合并连续空行；`saveBodyOnly:66-70`/`saveBodyWithVersion:75-79`入口统一调用；`storage.ts:119-120`/`260` 导入两路径同步；tab全去、6/8空格→4、2空格保留、连续空行合并已验证）
- **P0-1 AI 无法分类时标签留空**（2026-08-27 完成：`cards.ts:89-109` `DISCARD_TAGS` 5脏标签+`normalizeTags` trim/去DISCARD/去空去重/截4字/≤3空则[]，`ai.ts:113` `normalizeTags(rawTags)`，`prompts.ts:5` 约束「无法判断返回[]禁止占位」，`parseTags`不过滤保存量手动清理，新增不再出现「无法分类」）
- **P0-2 标签筛选态下新建默认携带当前选中标签**（2026-08-27 完成：`page.tsx:211-230` `handleCreate(body,title,aiTags)` `selectedTag&&!isDemoView`时 `Array.from(new Set([selectedTag,...aiTags])).slice(0,3)`强制首位去重≤3，全部/ demo不强制，vpn代理1→2验证）
- **P0-3 重复内容去重提示**（2026-08-27 完成：`page.tsx:214-223` `normalizeBody(body.trim())`全等比对`cards.find`命中`confirm`「检测到内容已存在（标题「X」），是否仍要添加？」取消中断/确认继续，空内容不弹，首个命中仅一次，Composer小风险已记录不阻断）
- **P0-4 网格卡片直删（可配置确认）**（2026-08-27 完成：`types.ts:27`+`storage.ts:66,70-78` `confirmDelete`默认true+normalize+`types`/`storage`/`page`三路径持久化；`CardItem.tsx:17-98` `onDelete`+编辑下垂直删除`text-rust` hover/focus-visible+demo隐藏；`page.tsx:352-360` 条件confirm+三分支+`SettingsModal.tsx:53-77` Switch即存合并保存）
- **P0-5 搜索高亮重做+亮色主题**（2026-08-27 完成：`globals.css:17-48` 双主题变量amber高亮暗琥珀42%+亮荧光笔+`html.light`纸墨；`CardItem.tsx:34` mark走变量；`layout.tsx:11,15-19` 防FOUC内联+suppressHydrationWarning；`page.tsx:40-44,77-89` 主题state+system监听+初始一致；`SettingsModal.tsx:78-94` select即存；搜qa亮/暗16命中高对比）
- **11合1 总验收（P0-6/P2-6/P2-7/P3-4/P3-5/P2-1/P2-5/P2-11/P2-3/P2-4/P3-2）**（2026-08-27 完成：P0-6亮/暗WCAG≥4.5:1高亮二次优化、P2-6评分守卫弹窗内屏蔽、P2-7空/离线横幅区分、P3-4 Composer自适应6行、P3-5导入Toast detail+跳过详情、P2-1版本节流失焦不建版、P2-5撤销Toast detail+10s撤销栈、P2-11批量多选、P2-3移动端抽屉onClose显隐、P2-4备注700ms防丢切卡、P3-2 VersionDiff高亮展开；Vision 11项抽查+定点走查+探活，Token高效版）
- **P0-6 高亮重开整改（遮挡修复）**（2026-08-28 完成：`globals.css:95-113` mark根因 `text-highlight`→`--color-highlight-text` 修复，亮`--color-highlight:#fcd34d` + `html.light mark` 50%半透明 + `color:var(--color-highlight-text)#451a03` 深棕强描边，暗`--color-highlight:#fbbf24`实底+`#111`黑字+`--color-highlight-ring/box-shadow`外发光，亮≈12.5:1暗≈11.3:1≥AA；`CardItem.tsx:37` mark无类名走全局mark）
- **P0-7 卡片空白回收**（2026-08-28 完成：`CardItem.tsx:57-77,129` 胶囊`absolute right-2 top-2` `bg-ink-900/80 backdrop-blur` `hover/focus-within/bulkActive`显隐不占流，标题`pr-16`让位code徽标，`line-clamp-2→3`正文多1行，卡片紧凑）
- **P0 标签系统核心 22项**（2026-08-28 完成：`tags.ts:14-94`纯函数+树+循环/重名检测+syncCardsToPromptTags、`TagPanel.tsx:树/展开记忆/完整路径搜索/无标签/⋯菜单`、`page.tsx:317-605` 创建/多标签/树/数量/筛选含父含子/加/移除/重命名子路径/移动防循环同父重名/删除双模式绝不删Prompt/当前继承/外键安全、`cards.ts:50字`根因修复；迁移11/55/0孤儿，验证树/筛选/移动子路径/循环拒绝/重名拒绝/删除保留）
- **P1-1~P1-4 四项打包（文案/草稿/导入/冲突）**（2026-08-28 完成：P1-1 TagPanel 在线/离线文案与服务端共享存储架构一致、P1-2 CardDetail/PreviewPanel 关闭·切换前 `clearTimeout+commitSave` 丢稿闭环、P1-3 TopBar `accept=".json,.md"` 与 Markdown 导出可逆、P1-4 Detail/Preview 统一「跳过冲突 code、其余照存」+ 同一 toast；QA 第十六次 4项 PASS、产品验收 PASS）
- **P2-10/P2-11 网格直删+批量管理**（2026-08-28 核验既有实现完成：P2-10 CardItem 悬浮胶囊 `text-rust` 删除 + `confirmDelete` 二次确认 + demo 隐藏 + 10s 撤销；P2-11 `bulkIds` Set + checkbox `role="checkbox"` + 顶部操作栏「已选 N 张」+ 打标签/打星/导出/删除/取消；QA 2026-08-28 12项 PASS、产品验收 6 维度 PASS，API 33→32）
- **P0-A 高影响标签操作的安全闭环**（2026-08-28 完成：影响数展示 `TagPanel` 含子树去重关联数+子标签名 + 四类 CRUD 10s 撤销 `captureTagSnapshot`/`notifyWithUndo` + `validateTagGraph` 五项服务端校验拒绝 + `knownVersion`/`baseVersion` 乐观并发 + `sanitizePromptTags` 自愈 + SSE 回声过滤；真机 vpn 删除→撤销全复原 + curl 7 项校验/冲突拒绝验证；QA 2026-08-28 4项 PASS、产品验收 4 维度 PASS，库 32/12/53/0 悬空 0 重复）
- **P2-5 危险操作撤销**（2026-08-27 完成：删除单卡/清空仓库/覆盖式导入/载入示例四类操作均新增 `notifyWithUndo` 10s 撤销栈，缓存被覆盖前的 `cards` 快照，误操作可一键回退；P2-1/P2-11 批量删除复用同套撤销机制；11合1总验收通过）
- **P2-3 移动端预览面板抽屉化**（2026-08-27 完成：`PreviewPanel.tsx` `<md` 时渲染为底部抽屉 `fixed inset-x-0 bottom-0 max-h-[75dvh]`，含收起按钮 `onClose`；桌面端保持侧边栏 `md:relative md:w-[var(--pw)]`；核心编辑路径移动端闭环；11合1总验收通过）

## 最近一次 Product 执行记录（P0-B/P0-C/P0-8/P0-9 验收）

- 时间：2026-08-28（产品验收 — P0-B/P0-C/P0-8/P0-9）
- 模式：Product Reviewer · 产品验收（代码走查 + 功能验证）
- 结果：**PASS** — 所有功能验证通过，无新增 P1/P2 阻断项
- 输入：`docs/qa/BUGS.md` + 代码实现 + 真机验证
- 体验方式：功能验证 + 代码走查
- 覆盖维度：
  1. P0-B 标签合并与批量移除：合并功能、同名重命名合并、批量移除、10标签上限 ✅
  2. P0-C 可组合标签筛选：OR/AND/NOT组合筛选、包含子标签开关、与全文搜索叠加 ✅
  3. P0-8 标签体系完善：标签重命名自动修正关联卡片标签 ✅
  4. P0-9 标签添加交互重构：#标签+回车/空格自动添加 ✅
- 结论：P0-B/P0-C/P0-8/P0-9 已验证通过，移入「已完成」；无新增 P1，阻断项：无

## P0 用户反馈（最高优先级 · 2026-08-28 新增，来自用户截图与口头反馈）

> 规则：此 P0 段为**最高优先级**，高于一切 P1/P2/P3；后续新增用户反馈均置顶于此，进入当前 PLAN 即时排期。

### P0-D 标签切换逻辑错误（2026-08-28 用户截图反馈）
- 问题：当前标签筛选为多选模式，需要点击两次才能切换标签，用户期望单点切换标签
- 用户场景：用户想单击标签查看不同标签下的内容，但现在需要点击两次才能切换
- 建议方案：修改TagPanel组件的筛选逻辑，从多选模式改为单选切换模式，保持OR/AND/NOT组合筛选功能
- 预期收益：提升标签切换效率，改善用户体验
- 实现成本：低
- 优先级：P0（用户反馈最高）

### P0-E 标签拖拽功能缺失（2026-08-28 用户截图反馈）
- 问题：无法通过拖拽建立子文件夹或合并文件夹，参考FLomo软件应支持拖拽排序、合并、将一个标签变为另一个标签的子标签
- 用户场景：用户希望通过拖拽操作来管理标签层级关系
- 建议方案：实现标签拖拽排序、拖拽建立子标签关系、拖拽合并标签功能
- 预期收益：提升标签管理效率，符合用户操作习惯
- 实现成本：中
- 优先级：P0（用户反馈最高）

### P0-F 右侧预览面板排版问题（2026-08-28 用户截图反馈）
- 问题：标题不够突出、"添加标签"文字说明多余、调取码单独一行占用空间太大、正文应该占页面60%以上
- 用户场景：用户期望右侧预览面板排版合理，正文占据主要空间
- 建议方案：优化标题显示、删除"添加标签"文字说明、优化调取码布局、调整模块顺序（标题→备注→标签→增加标签→正文）、确保正文占页面60%以上
- 预期收益：提升阅读体验，符合用户使用习惯
- 实现成本：低
- 优先级：P0（用户反馈最高）

### P0-G MCP连接说明文档缺失（2026-08-28 用户口头反馈）
- 问题：没有MCP连接的说明文档或方式，其他智能体无法更好地调用和连接
- 用户场景：用户希望其他智能体能够通过MCP连接调用提示词管理工具
- 建议方案：在设置中增加MCP连接说明，提供MCP连接方式和配置说明，示例代码和使用方法
- 预期收益：提升MCP集成可用性，便于其他智能体调用
- 实现成本：低
- 优先级：P0（用户反馈最高）

## P0 用户反馈（最高优先级 · 2026-08-28 新增，来自用户截图与口头反馈）

> 规则：此 P0 段为**最高优先级**，高于一切 P1/P2/P3；后续新增用户反馈均置顶于此，进入当前 PLAN 即时排期。

### P0-D 标签切换逻辑错误（2026-08-28 用户截图反馈）
- 问题：当前标签筛选为多选模式，需要点击两次才能切换标签，用户期望单点切换标签
- 用户场景：用户想单击标签查看不同标签下的内容，但现在需要点击两次才能切换
- 建议方案：修改TagPanel组件的筛选逻辑，从多选模式改为单选切换模式，保持OR/AND/NOT组合筛选功能
- 预期收益：提升标签切换效率，改善用户体验
- 实现成本：低
- 优先级：P0（用户反馈最高）

### P0-E 标签拖拽功能缺失（2026-08-28 用户截图反馈）
- 问题：无法通过拖拽建立子文件夹或合并文件夹，参考FLomo软件应支持拖拽排序、合并、将一个标签变为另一个标签的子标签
- 用户场景：用户希望通过拖拽操作来管理标签层级关系
- 建议方案：实现标签拖拽排序、拖拽建立子标签关系、拖拽合并标签功能
- 预期收益：提升标签管理效率，符合用户操作习惯
- 实现成本：中
- 优先级：P0（用户反馈最高）

### P0-F 右侧预览面板排版问题（2026-08-28 用户截图反馈）
- 问题：标题不够突出、"添加标签"文字说明多余、调取码单独一行占用空间太大、正文应该占页面60%以上
- 用户场景：用户期望右侧预览面板排版合理，正文占据主要空间
- 建议方案：优化标题显示、删除"添加标签"文字说明、优化调取码布局、调整模块顺序（标题→备注→标签→增加标签→正文）、确保正文占页面60%以上
- 预期收益：提升阅读体验，符合用户使用习惯
- 实现成本：低
- 优先级：P0（用户反馈最高）

### P0-G MCP连接说明文档缺失（2026-08-28 用户口头反馈）
- 问题：没有MCP连接的说明文档或方式，其他智能体无法更好地调用和连接
- 用户场景：用户希望其他智能体能够通过MCP连接调用提示词管理工具
- 建议方案：在设置中增加MCP连接说明，提供MCP连接方式和配置说明，示例代码和使用方法
- 预期收益：提升MCP集成可用性，便于其他智能体调用
- 实现成本：低
- 优先级：P0（用户反馈最高）

### P0-H MCP连接一键复制提示词（2026-08-28 用户口头反馈）— CLOSED 2026-08-28（QA验收 PASS，产品验收 PASS）
- 问题：P0-G 已在设置中添加 MCP 连接说明，但当前只是展示原始 JSON 配置和命令行，用户仍需手动复制配置、手动编辑文件。用户期望的是：直接复制一段完整的提示词/指令，发给 GPT/WorkBuddy/Orca，AI 代理能自动完成连接配置
- 用户场景：用户在 GPT 中想调用提示词管理器，希望复制一段话发给 GPT，GPT 自动配置 MCP 连接；同理 WorkBuddy、Orca opencode 终端也需要类似的一键连接体验
- 建议方案：将 SettingsModal 中 MCP 连接说明改为三个场景（GPT/WorkBuddy/Orca）的「一键复制提示词」，每个场景提供：1) 构建命令 2) 完整的 AI 代理可执行提示词（含环境检测、路径填充、配置写入、会话重开指令），附带复制按钮
- 预期收益：用户零配置成本，复制即用，大幅降低 MCP 接入门槛
- 实现成本：低（UI 改造 + 文案编写）
- 优先级：P0（用户反馈最高）

#### P0-H 产品验收（2026-08-28 真机 Orca Computer Use，QA 第二十次 ALL PASS）

- 时间：2026-08-28（产品验收 — P0-H MCP连接一键复制提示词）
- 模式：Product Reviewer · 产品验收（真机 Orca Computer Use 操作 + 代码走查）
- 结果：**PASS** — 功能可用，无新增 P0 阻断项
- 输入：`src/components/SettingsModal.tsx`（P0-H 实现）+ `docs/qa/BUGS.md` QA 验收记录
- 体验方式：真机 Orca Computer Use 操作 `localhost:3000` + 代码走查
- 覆盖维度：
  1. PM 视角：闭环达成——从 P0-G "仅展示 JSON"到 P0-H "可执行指令"，零配置门槛，文案含环境检测/路径填充/配置写入/新开会话强制，真正可交付给 GPT/WorkBuddy/Orca 执行。阻断：无。
  2. UX 视角：信息架构分层清晰（说明→三客户端卡→提示语），但可发现性与反馈强度不足（折叠+常驻已复制），初学者可能误点构建命令而非完整提示词。
  3. 真实用户视角：复制后粘贴给 AI 即可自动配好，成功可说"调取 <code>"触发 prompt_manager_activate_prompt（已在每段末尾固定），符合直觉；但若用户机器用户名/路径不同，会看到与自己不符的绝对路径，产生不信任感。
- P1 优化建议（后续择机）：
  1. SettingsModal.tsx:8 避免明文绝对路径：UI 展示用 "<项目根>" 占位，复制时再注入 MCP_PROJECT_ROOT
  2. details 默认展开或标题加 ● 新 徽标；或置顶至设置首位
  3. 复制按钮 2s 自动复位并加 aria-live 成功提示（现仅 error 有）
- 结论：P0-H 功能可用、复制链路 6/6 真机通过、文案对 WorkBuddy 最佳、GPT/Orca 需小幅命名与可读性优化后即可转阶段。建议 Builder 做上述 P1 三项微调（不改数据层，仅 SettingsModal.tsx 文案/样式/自动复位）后直接进入下一 Stage，无需新增 P0。

### P0-I 正文区域格式整理功能（2026-08-28 用户截图反馈）
- 问题：卡片粘贴正文后，文字没有向左对齐，导致空间浪费，缺乏格式整理功能
- 用户场景：用户粘贴内容到正文区域后，文字对齐不一致，影响阅读体验和空间利用
- 为什么是问题：正文区域是用户阅读和编辑的主要区域，格式混乱直接影响使用效率
- 建议方案：
  1. **自动整理**：默认关闭，可在右上角设置中开启；开启后AI自动整理粘贴内容的对齐方式（左/居中/右，可在设置中配置）
  2. **手动整理按钮**：在右侧正文区域下方，与「思维总结」「版本」在同一排，最右边位置；点击触发格式整理，默认对齐方式在设置中配置
- 预期收益：提升正文区域阅读体验，减少手动调整格式的时间
- 实现成本：中（需要新增设置项、格式整理逻辑、UI按钮）
- 优先级：P0（用户反馈最高）

#### P0-I 产品验收（2026-08-28 真机 Orca Computer Use，QA 第二十一次 PARTIAL PASS）

- 时间：2026-08-28（产品验收 — P0-I 正文区域格式整理功能）
- 模式：Product Reviewer · 产品验收（真机 Orca Computer Use 操作 + 代码走查）
- 结果：**PARTIAL PASS** — UI和设置链路已验证，AI整理执行链路未覆盖
- 输入：`src/components/PreviewPanel.tsx`（P0-I 实现）+ `docs/qa/BUGS.md` QA 验收记录
- 体验方式：真机 Orca Computer Use 操作 `localhost:3000` + 代码走查
- 覆盖维度：
  1. Settings配置：PASS - 自动整理开关和对齐方式选项正常
  2. PreviewPanel布局：PASS - 按钮位置正确（最右边）
  3. 手动整理：未测试 - 安全策略拦截AI请求
  4. 自动整理：未测试 - 安全策略拦截AI请求
- 结论：P0-I UI和设置链路已验证，AI整理执行链路需用户授权后才能测试。建议用户提供无敏感测试文本或授权使用当前卡片正文进行真机验收。
