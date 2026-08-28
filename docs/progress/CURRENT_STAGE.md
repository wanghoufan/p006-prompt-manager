# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder
> 基线：ORCA V2.1 §3

## 当前阶段
- Stage：P0-8 标签重命名（2026-08-28 用户反馈 P0 最高优先级；前置 P0 标签系统核心 22 项已完成）
- 完成度：实现 100%；自测 100%（tsc 0 / lint 0）
- 风险等级：L0（无阻断）；纯前端既有链路对齐，无新依赖
- 基线：上一阶段 P0 标签系统核心 22 项（31b1322 后已 PASS）

## 本轮已完成
- **P0-8 标签重命名**：
  - 入口：TagPanel 选中标签行 ⋯ 菜单「✎ 重命名」（既有 `TagMenu` + `handleRename`，prompt 输入新名，空名/同名 no-op 守卫）
  - `page.tsx handleRenameTag(id, name)`：空名校验 → 50 字上限 → `isNameUnique` 同父重名检测（excludeId 排除自身）→ `renameTag` 仅改 `Tag.name` + `updated_at` → **`applyTags` 原子落盘**（tags + promptTags + `syncCardsToPromptTags` 重建 Card.tags 冗余字段，方案 A 双写一致）
  - 父标签重命名：子标签完整路径经 `tagPath` 动态计算自动变化（交接 §8），无需改子标签数据
  - 核心收益：以稳定 tag_id 关联（交接 §39），重命名仅改一条 Tag 记录，全部关联卡片冗余字段整体重建，无逐卡写回、无 Prompt 正文改动
- **数据层**：types.ts 新增 Tag/PromptTag；新建 src/lib/tags.ts（守卫 + 树构建 + 循环/重名检测 + mutation 纯函数 + syncCardsToPromptTags 冗余同步）；serverStore.ts ServerState 加 tags/promptTags + isTag/isPromptTag 守卫；storage.ts 新增 TAGS_KEY/PROMPT_TAGS_KEY + load/save + push/load 透传；api/sync 透传
- **迁移脚本**：scripts/migrate-tags.mjs（dry-run → --apply + 自动 .bak 备份 + validate）。脏数据合并（多age×3、多aengt编程×1 → 多agent编程，无法分类删除），结果 tags=11 / promptTags=55 / 0 孤儿
- **TagPanel 树形 UI**：树渲染 + 展开/收起（localStorage 记忆 `pm:tag-expanded`）+ 选中高亮 + 直接/总数量 + 标签搜索（完整路径匹配）+ 无标签入口 + "+" 新建 + ⋯ 菜单（新建子标签 / 重命名 / 移动 / 删除）
- **page.tsx 核心交互**：tags/promptTags 状态 + 父含子筛选 + 无标签筛选 + 当前标签下新建继承 + 重名检测 + 删除确认 + 5 个标签 CRUD handler（createTag/renameTag/moveTag/deleteTag/setCardTags 通过 resolveTagIds 复用/新建）
- **编辑 UI**：CardDetail/PreviewPanel 标签 chip × 移除 + datalist 自动补全 + 创建新标签（输入即建）
- **根因修复**：cards.ts:107 原 `slice(0, 4)` 是「多age」碎片的根因（AI 生成路径截断 4 字），改为 50 字上限（对齐交接 §31），根治脏数据复发

## 涉及文件
- 修改：`src/app/page.tsx`（handleRenameTag 对齐 applyTags 原子落盘）
- 沿用既有：`src/components/TagPanel.tsx`（⋯ 菜单重命名入口）、`src/lib/tags.ts`（renameTag/tagPath）、`src/lib/types.ts`、`src/lib/cards.ts`、`src/lib/serverStore.ts`、`src/lib/storage.ts`、`src/app/api/sync/route.ts`、`src/components/CardDetail.tsx`、`src/components/PreviewPanel.tsx`
- 文档：`docs/pm/PLAN.md`（P0-8 段）、`docs/progress/CURRENT_STAGE.md`（本文件）

## 自测
- `npx tsc --noEmit`：零错误
- `npm run lint`：零错误零警告
- **P0-8 重命名流程走查**：`handleRenameTag` 空名→拒绝；>50 字→拒绝；同父重名（excludeId）→拒绝；`renameTag` 仅改目标 Tag 的 name/updated_at；`applyTags` 原子重建 tags+promptTags+Card.tags；父重命名后子标签 `tagPath` 输出新路径
- **迁移脚本 dry-run**：`tags=11 / promptTags=55 / 0 孤儿`（合并多age×3+多aengt编程→多agent编程，删除无法分类）
- **迁移脚本 --apply**：自动备份 `data/store.json.bak-20260827-133433`，校验全过
- **服务端 API**：`curl /api/sync` 返回 `cards:32 tags:11 promptTags:55 version:529`，孤儿校验通过
- **浏览器手测**（agent-browser Chromium @ localhost:3000）：
  - 标签树渲染：11 标签按频次+名称排序，全部/各标签计数正确
  - 点击「开发恢复」筛选 → 显示 11 张卡 ✓（与该标签频次一致）
  - 点击「无标签」筛选 → 显示 2 张卡（迁移预期：原本 1 张无标签「无有效信息」 + 「无法分类」被删后新增 1 张「测试语音输入法效果」）✓
  - **P0-15 安全约束验证**：删除「预览服务」标签（mock confirm=true）后，标签从 11→10，卡片总数 32→32 不变，原关联卡「预览链接获取与代码检查」仍存在（仅失去「预览服务」标签，其他标签保留）✓ 绝不删 Prompt 核心安全约束通过
  - 测试结束后从 `.bak` 恢复并重跑迁移，确保 store.json 回到迁移完成态

## 架构决策（与原方案的偏差说明）
- **「服务端 mutation 封装」落地方式**：迁移方案 §六 提议 mutation 封装在 serverStore，调用方经 API。但本项目现有架构是「客户端全量推 cards/settings 到服务端（serverStore 进程内单例）」（incrementCopy 是唯一的独立服务端 mutation）。为了最小改动且复用现有 writeChain/SSE 同步链路，标签操作统一为：客户端调用 `src/lib/tags.ts` 纯函数（createTag/renameTag/moveTag/deleteTag/setCardTags/addCardTag/removeCardTag/syncCardsToPromptTags）保证安全语义（级联不删 Prompt、防循环、重名检测、原子替换），然后随 cards 一起全量推送到服务端。服务端 serverStore 在 `setState` 落盘前用 `isTag/isPromptTag` 守卫过滤非法数据 + 完整性校验（无孤儿/唯一约束/环）做纵深防御。这是符合「最小改动、不破坏现有同步模型」的合理适配；如未来需要「服务端权威 mutation API」供 MCP 等直接调用，可基于现有 tags.ts 纯函数 + serverStore 接口扩展，不阻塞当前 P0 落地。
- **多标签上限 3 个保持不变**：审计 §四 P0-2 标注「上限 3 与交接 §4 冲突（交接未限 3）」，建议「迁移后放开上限（或明确产品决策）」。本轮产品决策待定，保留现有 3 个上限（不动 parseTags/normalizeTags/handleBulkTag 等多处 slice(0,3)），注释里已记录「待产品决策」，后续若放开只需同步放开 handleCreate/resolveTagIds/handleBulkTag 的 slice 限制即可。
- **Card.tags 保留（方案 A 双写）**：迁移后 Card.tags 字段保留为合并后标签名数组，与 promptTags+tags 同步维护（syncCardsToPromptTags 统一重建）。优点：isCard 校验不变、旧客户端/导出/离线兜底兼容。同步时机：每次 tags/promptTags 变更后整体重建（32 卡性能无压力）。
- **demo 视图无 tag 实体**：用 deriveTagsFromCards(DEMO_CARDS) 派生临时 tags/promptTags（id 稳定 tag_derive_N），TagPanel 只读无管理入口，筛选逻辑统一。

## 给下一角色的技术交接要点
- QA 重点（P0-8 重命名）：
  - 重命名后该标签所有关联卡片 chip / 列表 / 详情自动显示新名，无需逐卡改
  - 同父重名、空名、>50 字被拒绝并提示
  - 父标签重命名后子标签完整路径（搜索 / title）自动变化
  - 重命名不改动卡片正文 / updatedAt（仅冗余字段 tags 重建）
  - 重命名后 `/api/sync` 数据一致（tags 新名 + cards.tags 冗余同步）
- QA 重点（P0-1~P0-22 回归）：覆盖树/展开/搜索/补全/数量/筛选/父含子/加/移除/重命名/移动/删除/无标签/继承/重名/确认
- 验证「删除含子标签的父标签」两种模式（仅自身 / 整棵子树）
- 验证「编辑时输入不存在的标签名」自动创建实体（resolveTagIds 隐式触发）
- 验证 CardDetail/PreviewPanel chip × 移除走 tagsText 编辑链路，不污染全局
- 验证 Card.tags 冗余与 promptTags 一致（rename 后 chip 自动更新）
- 浏览器实测「重命名后 UI 一致」「移动后子路径正确」「循环检测拒绝」「重名检测拒绝」「多设备同步」
- 浏览器截图：`scratch/p0-tags-tree.png`（已附）、`scratch/p0-tags-untagged.png`（已附）
- 风险：P0-8 改动面小（仅 handleRenameTag 对齐 applyTags），QA 重点回归重命名批量一致性

## 已收口，待 QA 验收（2026-08-28，P0-8 标签重命名）
- 本轮已交付，待 QA 验收。
