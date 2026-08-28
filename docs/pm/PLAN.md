# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 上一轮 P0-B 标签合并与批量移除 + P0-C 可组合筛选（2026-08-28，代码实现完成）已交付。上上轮：P0-A 安全闭环（QA/产品 PASS）。下一轮待排期：**剩余 P2 优化项**择机排期。

## 当前目标

0. **P0-B 标签合并与批量移除**（2026-08-28 智能体审查建议，最高优先级 — 已完成）：
   - "合并到…"：迁移源标签关系到目标标签、自动去重、删除源标签、绝不删除 Prompt ✅
   - 重命名遇同级同名时提供"取消 / 改名 / 合并到现有标签" ✅
   - 批量操作栏增加"移除标签"，仅解除所选 Prompt 的关系，不删全局标签 ✅
   - 解除标签上限 3 个（改为 10 个），对旧数据、创建、编辑、批量操作统一处理 ✅

1. **P0-C 可组合的标签筛选**（2026-08-28 智能体审查建议，最高优先级 — 已完成）：
   - 从"单选标签"升级为筛选条件组：包含任一（OR）、必须同时包含（AND）、排除（NOT）✅
   - "包含子标签"开关 + 与已有全文搜索/@调取码搜索叠加 ✅

2. **P0-A 高影响标签操作的「安全闭环」**：已交付（见「已收口」QA/产品验收 PASS）。

3. **P0-8 标签重命名**：已交付，见「已收口」。

4. **P0 标签系统 22 项核心能力**：已交付，见「已收口」。

## 验收标准（P0-A — 已通过 QA/产品验收 2026-08-28）

- 删除前显示真实影响数：删除确认展示关联 Prompt 数（含子标签去重）与子标签（名/数），提示词本身不删除 ✅
- 标签级操作（创建/重命名/移动/删除）Toast 内 10s「撤销」，撤销后 Tag 实体、promptTags 关联、卡片冗余 tags 显示全部恢复（真机验证：vpn 删除→撤销后 `vpn 1`、关联 1、卡片 tags=['vpn'] 复原） ✅
- 服务端写入前校验拒绝非法数据：父级不存在 / 层级成环 / 同父重名 / 关联悬空 / (prompt_id, tag_id) 重复 / 标签 id 重复 → 均返回 `数据校验失败` 且不落盘（curl 七项逐条验证） ✅
- 带版本号提交：`baseVersion` 与当前版本不一致 → 返回 `版本已变化…请刷新后重试`（conflict）且不落盘；一致则正常写入版本 +1；内容无变化保持版本号 ✅
- `npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告；`npm run build` 通过 ✅
- 既有能力不破坏：标签树/筛选/CRUD/实时同步/撤销栈/批量管理回归通过；数据完整性 32 卡 / 12 标签 / 53 关联 / 0 悬空 / 0 重复 ✅

## 实施方案（P0-A）

### 数据层
- `src/lib/tags.ts`：新增 `validateTagGraph(tags, promptTags, cardIds)` 纯函数，五项完整性校验同源复用（客户端守卫 + 服务端纵深防御）
- `src/lib/serverStore.ts`：`setState` 增加 `baseVersion` 可选参数与校验；新增 `SetStateResult = number | {ok:false, error, conflict?}`；落盘前 `validateTagGraph` 校验，非法/冲突拒绝并返回错误对象（route 透传）

### 接口层
- `src/app/api/sync/route.ts`：**必要偏差**——透传 body 的 `baseVersion` 给 `setState`（版本号提交若不透传则无法实现，见下「偏差说明」）

### 同步层（storage.ts）
- `knownVersion` 追踪（loadFromServer / pushToServer 成功后同步）
- `pushToServer` 携带 `baseVersion`，返回 `'ok' | 'conflict' | 'error'`
- `doPush` 冲突处理：拒绝 → `loadFromServer` 刷新权威数据（更新 knownVersion）→ 基于最新版本重试 → `onConflictRefresh` 通知页面重载视图 + 提示用户
- `sanitizePromptTags`：推送/加载时净化悬空（卡片/标签不存在）与重复关联，自愈旧数据、避免服务端校验误拒

### 交互层（page.tsx）
- `captureTagSnapshot` / `restoreTagSnapshot`：标签级操作（创建/重命名/移动/删除）前后三态快照，`notifyWithUndo` 10s 撤销整体回退
- 卡片删除/批量删除/清空仓库：删除卡片时同步清理其 promptTags 关联（关联不悬空 + 计数不再虚高）
- 载入示例 / 导入：按新卡片的字符串标签重建 tags/promptTags（关联不悬空），撤销一并回退
- 注册 `setConflictRefreshHandler`：版本冲突后重载服务端权威视图并 toast 提示

### 偏差说明（Builder 权限外必要改动，需记录）
- **`src/app/api/sync/route.ts` 已改动**：透传 `baseVersion` 给 `setState`。任务「带版本号提交；版本已变化则拒绝」必须在服务端读到客户端声明的基础版本，而该值只能经 route 从请求体透传；`setState` 拿不到即版本校验永不生效（已实测：不透传时冲突写入被静默接受）。改动仅 2 行（类型扩展 + baseVersion 透传），无行为变更面。请 Planner/Reviewer 知悉。
- **数据恢复事件（重要，需 QA 知悉）**：验证「版本冲突拒绝」时，首次测试因 route 未透传 `baseVersion`，冲突 payload 被当作正常写入落盘，将实时共享库 `data/store.json`（version 1017，32 卡 / 19 标签 / 56 关联）覆盖为空。已从 `data/store.json.bak-20260827-renamefix`（32 卡 / 12 标签 / 53 关联）恢复，并在修复 route 透传后重新验证冲突拒绝通过。**相对事故前的实时数据，损失 7 个标签与 3 条关联（renamefix 快照之后新增）**；卡片 32 张完整保留。如用户浏览器 localStorage 仍存旧数据（未在事故窗口被 SSE 覆盖的标签页），重连后会自动迁移回补。本次真机验证产生的所有临时改动（vpn 删除/撤销、p0a-undo-test 创建/删除、临时标签写入/回滚）均已清理，最终库 32 / 12 / 53 / 0 悬空 / 0 重复。

## 已收口（2026-08-28，P2-10/P2-11 网格直删+批量管理）

- **P2-10 网格直删入口（核验既有实现）**：`CardItem` 悬浮胶囊 `text-rust` 删除按钮（`onDelete` prop，`!readonly` 渲染，`stopPropagation`）+ `handleDeleteCard` 条件 `confirm`「确定删除「{title}」？此操作不可撤销。」+ `snapshot` + `notifyWithUndo` 10s 撤销 + demo 隐藏；`isDemoView ? undefined : handleDeleteCard`。
- **P2-11 批量管理（核验既有实现）**：`bulkIds` Set + `CardItem` checkbox（`role="checkbox" aria-checked`）+ 顶部批量操作栏「已选 N 张」+ 打标签（prompt→parseTags→addCardTag 去重≤3→syncCards）/ 打星（0-5 校验）/ 导出（buildMarkdownExport）/ 删除（confirm 含数 + 撤销）/ 取消选择（clearBulk）。
- 涉及文件：`src/components/CardItem.tsx`、`src/app/page.tsx:490-662`（handleDelete/handleBulk*）、`src/lib/storage.ts`/`types.ts`（confirmDelete）；核验无新增改动，12项 QA/产品验收 PASS。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告；API `/api/sync` 33→32。

## 已收口（2026-08-28，P1 产品缺陷 4 项打包）

- **P1-1 TagPanel 底部文案与同步架构一致**：`TagPanel.tsx` 底部文案改为在线「已开启局域网实时同步（服务端共享存储），离线时回退本机缓存」、离线（`offline` prop，`serverOnline===false`）「未连接同步服务，已使用本机本地数据」。验证原「数据仅存于本机」误导已消除，文案与 README/HANDOFF/CURRENT_STAGE 所述服务端共享存储 + localStorage 离线兜底 + SSE 实时同步一致。
- **P1-2 关闭/切卡不再静默丢稿**：CardDetail `handleClose`（Esc / 蒙层 / 关闭按钮）先 `clearTimeout(notesTimer)` + `commitSave(true)` 再 `onClose`；PreviewPanel 移动端抽屉「收起」新增 `handleClose` 同样先 flush；切换选中经 `key={previewCard?.id}` 重挂 + 卸载 effect flush 兜底；两组件卸载 effect 均 `clearTimeout(notesTimer)` + `saveThrough(true,true)`。杜绝光标仍在输入框时 Esc / 收起 / 切卡导致的修改丢失。
- **P1-3 导入选择器支持 .md**：`TopBar.tsx:70` `accept=".json,.md,application/json,text/markdown"`，按钮 `title`「导入备份（支持 JSON 与 Markdown）」——与 `parseImport`/`buildMarkdownExport` 导出 Markdown 闭环一致（本项代码已在库中，本次核验确认）。
- **P1-4 调取码冲突语义统一**：CardDetail 与 PreviewPanel 均为「跳过冲突 code 字段、其余字段照存」+ 冲突提示「该调取码已被其他卡片使用，请更换」+ 保存时 toast「调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试」（两组件 saveThrough 逻辑一致，本项核验确认）。
- 涉及文件：`src/components/TagPanel.tsx`、`src/components/PreviewPanel.tsx`（本次修改）；`src/components/TopBar.tsx`、`src/components/CardDetail.tsx`（核验既有实现）。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告。

## 已收口（2026-08-27，P0 标签系统 22 项）

- 数据层（types/tags/serverStore/storage/api sync）+ 迁移脚本（dry-run → --apply → 校验）+ 树形 TagPanel + 核心交互（创建/多标签/搜索/补全/数量/筛选/父含子/加/移除/重命名/移动/删除/无标签/继承/重名/确认/外键安全/循环检测）全部就绪
- 涉及文件：`src/lib/tags.ts`（新增）、`scripts/migrate-tags.mjs`（新增）、`src/lib/types.ts`、`src/lib/cards.ts`、`src/lib/serverStore.ts`、`src/lib/storage.ts`、`src/app/api/sync/route.ts`、`src/app/page.tsx`、`src/components/TagPanel.tsx`、`src/components/CardDetail.tsx`、`src/components/PreviewPanel.tsx`
- 浏览器实测（agent-browser）：11 标签树渲染、点击「开发恢复」→ 11 张、点击「无标签」→ 2 张（迁移预期）、删除「预览服务」→ 标签 11→10、卡片 32→32 安全约束通过
- 迁移报告：`tags=11 / promptTags=55 / 0 孤儿`，备份 `data/store.json.bak-20260827-133433`

## 已收口（2026-08-28，P0-A 高影响标签操作的「安全闭环」— QA/产品验收 PASS）

- **删除前真实影响数**：删除确认展示关联 Prompt 数（子树去重）与子标签；真机验证 vpn「当前有 1 条提示词使用此标签」。
- **10s 撤销**：创建/重命名/移动/删除四类标签级操作全部 `notifyWithUndo`，`captureTagSnapshot`/`restoreTagSnapshot` 三态快照回退；真机验证 vpn 删除→撤销后标签、关联（1）、卡片冗余 tags=['vpn'] 全部复原。
- **服务端写入前校验**：`tags.ts` 新增 `validateTagGraph`（父级存在/无环/同父无重名/关联不悬空/唯一/id 重复）；`serverStore.setState` 落盘前校验拒绝非法数据（curl 七项逐条验证）。
- **带版本号提交**：`storage.pushToServer` 携带 `baseVersion`；`setState` 版本已变化→conflict 拒绝不落盘；客户端刷新权威数据后重试 + `onConflictRefresh` 通知页面重载视图；route.ts 透传 baseVersion（必要偏差，见上方偏差说明）。
- **关联不悬空配套**：卡片删除/批量删除/清空/载入示例/导入同步清理或重建 promptTags；`sanitizePromptTags` 推送/加载净化悬空与重复。
- 涉及文件：`src/lib/tags.ts`、`src/lib/serverStore.ts`、`src/lib/storage.ts`、`src/app/api/sync/route.ts`（必要偏差）、`src/app/page.tsx`。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告；`npm run build` 通过；真机（Orca Computer Use）验证删除影响数/撤销恢复/服务端校验/版本冲突；最终库 32 卡 / 12 标签 / 53 关联 / 0 悬空 / 0 重复。QA 2026-08-28 4项 ALL PASS + 产品验收 4维度 PASS。

## 已收口（2026-08-28，P0-8 标签重命名）

- 选中标签 ⋯ 菜单「✎ 重命名」→ prompt 输入新名 → `handleRenameTag` 校验（空名 / 50 字 / 同父重名 `isNameUnique`）→ `renameTag` 仅改 `Tag.name` → `applyTags` 原子落盘（`syncCardsToPromptTags` 重建 Card.tags 冗余字段，方案 A 双写一致）。
- 涉及文件：`src/components/TagPanel.tsx`（既有入口，无需改动）、`src/app/page.tsx`（handleRenameTag 对齐 applyTags 原子落盘）、`src/lib/tags.ts`（既有 renameTag + tagPath 动态计算，无需改动）。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告。
- 要点：稳定 tag_id 关联 → 仅改一条 Tag 记录即可完成全量关联更新（交接 §39）；父重命名子路径经 `tagPath` 动态计算自动变化（交接 §8）。

## 已收口（2026-08-28，P0-6 重开 + P0-7 两项打包）

- P0-6 修复 mark 类名根因 + 亮/暗高对比调优；P0-7 操作列悬浮胶囊化 + 正文 3 行
- 涉及文件：src/components/CardItem.tsx、src/app/globals.css、eslint.config.mjs
- 浏览器实测截图：scratch/p06-light-qa-v2.png（亮色 qa 高亮）、p06-dark-qa-final.png（暗色 qa 高亮）、scratch/p07-dark-grid.png（暗色默认网格，对比亮色同样布局紧凑）

## 已收口（2026-08-27，commit 2e7b635）

- 11 合 1（P0-6 高亮二次优化 + P2-6/P2-7/P3-4/P3-5 + P2-1/P2-5/P2-11 + P2-3/P2-4/P3-2）已交付并通过 QA / 产品 PASS。
