# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder
> 基线：ORCA V2.1 §3

## 当前阶段
- Stage：P0-A 高影响标签操作的「安全闭环」（2026-08-28；对齐 PRODUCT_BACKLOG P0 段最高优先级）— **已收口，QA/产品验收 PASS**
- 完成度：实现 100%；自测 100%（tsc 0 / lint 0 / build 通过；真机验证影响数/撤销/服务端校验/版本冲突）；QA 100%（4项 ALL PASS，`docs/qa/BUGS.md:608-668`）+ 产品验收 PASS（4维度）
- 风险等级：L1（低）；含一处权限外必要改动（route.ts 透传 baseVersion，已记录偏差）与一次数据恢复事件（见下，已恢复并验证）
- 基线：上一阶段 P2-10/P2-11 网格直删+批量管理（1a3086e 之后，本轮待推送）

## 本轮已完成
- **删除前真实影响数**：删除确认展示关联 Prompt 数（子树去重）+ 子标签；真机验证「删除标签『vpn』？当前有 1 条提示词使用此标签」（合并/批量移除影响数展示属 P0-B，本轮不在范围）
- **标签级操作 10s 撤销**：`captureTagSnapshot`/`restoreTagSnapshot` 三态快照（tags/promptTags/cards）→ `notifyWithUndo` 10s 撤销；覆盖创建/重命名/移动/删除四类；真机验证 vpn 删除→撤销后标签、关联（1）、卡片冗余 tags=['vpn'] 全部复原
- **服务端写入前校验**：`tags.ts` 新增 `validateTagGraph`（父级存在/无环/同父无重名/关联不悬空/(prompt_id,tag_id) 唯一/id 重复）；`serverStore.setState` 落盘前校验，非法数据拒绝并返回可读错误（curl 七项逐条验证）
- **带版本号提交**：`storage` 新增 `knownVersion` 追踪；`pushToServer` 携带 `baseVersion` 返回 `'ok'|'conflict'|'error'`；`doPush` 冲突→刷新权威数据→基于最新版本重试→`onConflictRefresh` 通知页面重载视图并 toast 提示；`route.ts` 透传 baseVersion（必要偏差）
- **关联不悬空配套**：卡片删除/批量删除/清空仓库同步清理 promptTags；载入示例/导入按新卡片字符串标签重建 tags/promptTags；`sanitizePromptTags` 推送/加载净化悬空+重复（自愈旧数据）

## 涉及文件
- `src/lib/tags.ts`（validateTagGraph）、`src/lib/serverStore.ts`（setState 版本+校验+union 返回）、`src/lib/storage.ts`（knownVersion/sanitize/conflict 重试/回调）、`src/app/api/sync/route.ts`（透传 baseVersion，**权限外必要偏差**）、`src/app/page.tsx`（撤销快照/卡片删除清理关联/导入示例重建/冲突回调）
- 文档：`docs/pm/PLAN.md`（当前目标+实施方案+偏差说明+已收口）、`docs/progress/CURRENT_STAGE.md`（本文件）

## 自测
- `npx tsc --noEmit`：零错误；`npm run lint`：零错误零警告；`npm run build`：通过
- **服务端校验（curl 逐条）**：同父重名/父标签不存在/层级成环/关联悬空/关联重复/标签 id 重复 → 均 `数据校验失败` 且不落盘；版本冲突（baseVersion≠当前）→ `版本已变化…请刷新后重试`(conflict) 且不落盘；合法写入版本+1；无变化保持版本号
- **真机（Orca Computer Use, localhost:3000）**：删除 vpn 确认显示「当前有 1 条提示词使用此标签」→ 删除 → Toast「已删除标签『vpn』（提示词未受影响）」+ 撤销 → 点击撤销后标签/关联/卡片 tags 全复原；创建 p0a-undo-test → 删除 → 撤销复原 → 清理删除；临时标签写入/回滚经 API 完成
- **数据完整性**：最终库 32 卡 / 12 标签 / 53 关联 / 0 悬空 / 0 重复；无测试残留

## 架构决策（与原方案的偏差说明）
- **`src/app/api/sync/route.ts` 改动（必要偏差）**：「带版本号提交」必须在服务端读到客户端声明的基础版本，只能经 route 从请求体透传给 `setState`；不透传则版本校验永不生效（实测冲突写入被静默接受）。改动仅 2 行，无行为变更面，已记录于 PLAN 偏差说明，请 Review/QA 知悉。
- **数据恢复事件（重要）**：验证冲突拒绝时，首次测试因 route 未透传 baseVersion，冲突 payload 被当作正常写入，将实时库 `data/store.json`（version 1017，32 卡/19 标签/56 关联）覆盖为空。已从 `data/store.json.bak-20260827-renamefix`（32 卡/12 标签/53 关联）恢复，修复 route 透传后重新验证通过。**相对事故前实时数据损失 7 个标签与 3 条关联**（renamefix 快照之后新增）；32 张卡片完整。若某浏览器标签页 localStorage 仍存旧数据（未被事故窗口 SSE 覆盖），重连会自动迁移回补。真机验证产生的全部临时改动已清理。
- **标签级撤销范围**：仅覆盖 TagPanel 四类 CRUD（创建/重命名/移动/删除）；卡片编辑（chip 增删、handleUpdateMeta）与批量打标签为失焦自动保存路径，不纳入 10s 撤销（避免与自动保存语义冲突），保持既有行为。
- **服务端校验为「拒绝」而非「净化」**：符合任务「校验拒绝非法数据」要求；客户端推送前 `sanitizePromptTags` 净化悬空/重复，保证正常操作永不触发拒绝且旧数据自愈。
- **版本冲突语义**：拒绝后刷新到服务端权威数据并提示用户重试；本地刚执行的未落盘操作不自动重放（无操作日志），用户可见并按需重做。

## 给下一角色的技术交接要点（QA）
- QA 重点（删除影响数）：
  - 删除「vpn」→ 确认框显示「当前有 1 条提示词使用此标签」；含子标签的标签（如「开发恢复2」）确认框含子树关联数与子标签名
  - 确认删除后卡片不删除（32→32），仅标签与关联移除
- QA 重点（10s 撤销）：
  - 删除标签 → Toast「已删除标签『x』（提示词未受影响）」+「撤销」，10s 内点击 → 标签恢复、关联恢复、该标签筛选恢复
  - 重命名/移动/创建标签 → 同样有撤销，点击后回退到操作前状态
- QA 重点（服务端校验拒绝）：
  - 直接 POST /api/sync 非法数据（悬空关联/同父重名/循环/重复）→ 返回 `数据校验失败：…` 且 store.json 不变
- QA 重点（版本冲突）：
  - 带过期 baseVersion 的 POST → `版本已变化…请刷新后重试`(conflict)；双开两标签页模拟两客户端同时写 → 后写者被拒并刷新视图 + toast 提示
- 回归：P0 标签系统 22 项不破坏（树/筛选/CRUD/迁移 11/55/0 孤儿）；卡片删除/批量删除/清空/导入/示例后标签计数不虚高、无悬空；实时同步、失焦自动保存、版本、搜索、批量管理既有能力不受影响
- 风险：L1——数据恢复事件损失 7 标签/3 关联（详见上文）；若用户浏览器 localStorage 仍有旧数据，重连会自动回补；版本冲突下未落盘操作需用户重做（有 toast 提示）

## 已收口（2026-08-28，P0-A 高影响标签操作的「安全闭环」— QA/产品验收 PASS）

- Builder 自测完成（tsc 0 / lint 0 / build 通过 / 真机验证 / curl 7 项校验，库 32/12/53/0 悬空 0 重复）
- QA 验收（2026-08-28，`docs/qa/BUGS.md:608-668`）：4项 ALL PASS — 影响数展示/10s 撤销/服务端 5 项校验/带版本号提交，tsc 0/lint 0，无新增 Bug
- 产品验收（2026-08-28，`docs/review/PRODUCT_BACKLOG.md` P0-A 段）：4维度 PASS，移入「已完成」，无新增 P1，待本轮工程收尾推送
- 下一步：P0-B 标签合并与批量移除 + P0-C 可组合筛选 + 剩余 P2 择机排期