# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 上一轮 P0-8 标签重命名（2026-08-28）已交付。上上轮：P0-6 重开 + P0-7 打包。本轮：**P1 产品缺陷 4 项打包（P1-1~P1-4，低成本单工位闭环）**（对齐 PRODUCT_BACKLOG P1 段）。

## 当前目标

0. **P0-8 标签重命名**（2026-08-28 用户反馈，最高优先级）：
   - 选中标签重命名时，带有该标签的所有笔记自动修正为新标签（批量原子更新，无逐卡手动改）。
   - 入口：TagPanel 选中标签行 ⋯ 菜单「✎ 重命名」（`TagPanel.tsx:91-92` + `handleRename`）。
   - `page.tsx handleRenameTag(id, name)`：空名校验 → 50 字上限 → `isNameUnique` 同父重名检测 → `renameTag` 仅改 `Tag.name` → `applyTags` 原子落盘（`syncCardsToPromptTags` 重建 Card.tags 冗余字段）。
   - 父标签重命名：子标签路径自动变化（`tagPath` 动态计算，交接 §8）。
   - 已有关联卡片无需逐条写回：以稳定 tag_id 关联（交接 §39），仅改一条 Tag 记录 + 冗余字段整体重建。

1. **P0 标签系统 22 项核心能力**（基于 `docs/review/标签系统-现状审计.md` 现状 + `docs/review/标签系统-迁移方案.md` 设计 + 交接文档 §38-§43 数据结构）：
   - **数据层**：types.ts 新增 `Tag` / `PromptTag` 类型；新建 `src/lib/tags.ts`（守卫 + 树构建 + 循环/重名检测 + 8 个 mutation 纯函数 + syncCardsToPromptTags 冗余同步）；serverStore.ts `ServerState` 扩展 `tags` / `promptTags` 集合 + `isTag`/`isPromptTag` 守卫过滤；storage.ts 新增 `TAGS_KEY` / `PROMPT_TAGS_KEY` + load/save + push/load 透传；api/sync GET/POST 透传
   - **迁移**：`scripts/migrate-tags.mjs` 一次性迁移 32 卡 → 11 实体，MERGE 3 脏数据（多age×3 + 多aengt编程×1 → 多agent编程；无法分类删除），dry-run 报告 + 自动 .bak 备份 + `--apply` 落盘 + validate（55 关联 / 0 孤儿 / 0 重复 / isCard 全过）
   - **标签树 UI**：`TagPanel.tsx` 由扁平列表改为树形（parent_id 树、展开/收起 + localStorage 记忆 `pm:tag-expanded`、选中高亮、直接/总数量、标签搜索「完整路径匹配」、无标签入口、`+` 新建、`⋯` 菜单「新建子标签/重命名/移动/删除」）
   - **核心交互**：page.tsx 5 个标签 CRUD handler（createTag/renameTag/moveTag/deleteTag/setCardTags，通过 resolveTagIds 复用/新建实体），父含子筛选（`collectDescendantIds` + `collectTagPromptIds`），无标签筛选（基于 promptTags 关系），当前标签下新建继承（tag_id 首位），重名检测（`isNameUnique`），删除确认（TagPanel 二级 confirm + 模式选择），Card.tags 冗余同步（`syncCardsToPromptTags`）
   - **编辑 UI**：CardDetail/PreviewPanel 标签 chip + `×` 移除（走 tagsText 编辑链路 → handleUpdateMeta 原子替换关系）+ `<datalist>` 自动补全（`existingTags` 候选）+ 输入新名自动建实体

2. **根因修复**：cards.ts:107 原 `normalizeTags` 的 `slice(0, 4)` 是「多age」碎片产生的根源（AI 生成路径截断 4 字），改为 50 字上限（对齐交接 §31）。迁移合并存量碎片；根治逻辑杜绝新碎片产生。

## 验收标准

- 迁移：`tags=11 / promptTags=55 / 0 孤儿`，自动备份 `data/store.json.bak-<ts>`
- `tsc --noEmit` 零错误 ✓；`npm run lint` 零错误零警告 ✓
- 浏览器手测覆盖：标签树渲染 + 数量正确、点击筛选（含父含子）、无标签入口、搜索补全、创建/重命名/移动/删除、二级确认、删除后卡片保留（32→32）
- 既有 11 项 + P0-6/P0-7 不破坏
- 卡片 32 / 标签 11 / 关联 55 / 0 孤儿 / 0 重复

## 实施方案

### 数据层
- `src/lib/types.ts`：新增 `Tag`、`PromptTag` 接口
- `src/lib/tags.ts`（新增）：isTag/isPromptTag/normalizeTag 守卫；newTag/isNameUnique/assertNoCycle/collectDescendantIds/tagPath 工具；directCount/totalCount/collectTagPromptIds/tagIdsOfPrompt/promptTagNamesOf/syncCardsToPromptTags 关系计算；createTag/renameTag/moveTag/deleteTag/setCardTags/addCardTag/removeCardTag 8 个 mutation 纯函数；childrenOf/buildTagTree 树构建；deriveTagsFromCards 兜底派生（demo + 未迁移旧数据）
- `src/lib/serverStore.ts`：ServerState 加 `tags: unknown[]`、`promptTags: unknown[]`；ensureLoaded 用守卫过滤；setState 扩展签名接收 tags/promptTags 并做内容比对避免无变化推送
- `src/lib/storage.ts`：新增 `TAGS_KEY`、`PROMPT_TAGS_KEY`；loadTags/saveTags/loadPromptTags/savePromptTags；pushToServer 接收 4 参（cards/settings/tags/promptTags）；loadFromServer 返回 4 元组；subscribeSync 回调 4 参；loadFromServer 成功后同步 cacheTags/cachePromptTags
- `src/app/api/sync/route.ts`：GET 返回 4 字段；POST 接收 4 字段

### 迁移
- `scripts/migrate-tags.mjs`（新增）：`MERGE` 表（多age/多aengt编程→多agent编程，无法分类→null）；dry-run 报告「合并/删除/去重/实体清单/校验」；`--apply` 自动备份（`store.json.bak-YYYYMMDD-HHMMSS`）+ 写盘 version+1 + validate；失败可从 .bak 回滚

### UI
- `src/components/TagPanel.tsx`：完全重写，接收 tags/promptTags/total/untaggedCount/selected/onSelect/editable CRUD 回调；树形递归 TreeNode；展开 Set 写 localStorage；搜索匹配 name 或完整路径；空标签入口
- `src/app/page.tsx`：新增 tags/promptTags state；activeTagData 派生（demo 派生、mine 用 state）；untaggedCount；baseCards 父含子 + 无标签筛选；resolveTagIds 名字→id 解析；applyTags 统一提交（同步冗余）；handleCreate 继承当前 tag_id；handleUpdateMeta 走 setCardTags 原子替换；handleDeleteTag 改为删实体 + 级联；handleCreateTag/handleRenameTag/handleMoveTag 返回 {ok,error}
- `src/components/CardDetail.tsx` / `PreviewPanel.tsx`：标签区加 chips × 移除（更新 draft.tagsText → handleUpdateMeta）+ `<datalist>` 自动补全
- `src/lib/cards.ts`：normalizeTags 的 `.slice(0, 4)` 改为 `.slice(0, 50)`（根因修复）

### 已知限制 / 待产品决策
- **多标签上限 3 个保持不变**：审计 §四 P0-2 标注「上限 3 与交接 §4 冲突」，建议「迁移后放开上限（或明确产品决策）」。本轮保留现有 3 个上限（parseTags/normalizeTags/handleBulkTag 等多处 slice(0,3) 未变），resolveTagIds 也尊重此约束。若放开，后续只需同步放开 handleCreate 与 handleBulkTag 的 slice 限制。

## 进行中 / 待办

- P2-10/P2-11 已通过 QA（2026-08-28 12项 PASS）与产品验收 PASS，待工程收尾提交推送。

---

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
