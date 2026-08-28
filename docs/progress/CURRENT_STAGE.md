# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder
> 基线：ORCA V2.1 §3

## 当前阶段
- Stage：P2-10/P2-11 网格直删+批量管理（2026-08-28；12项验收，核验既有实现；对齐 PRODUCT_BACKLOG P2-10/P2-11）
- 完成度：实现 100%；自测 100%（tsc 0 / lint 0，API 33→32）
- 风险等级：L0（无阻断）；核验既有 CardItem 胶囊直删 + bulk 批量能力，无新依赖，改动面为文档收口
- 基线：上一阶段 P1-1~P1-4 四项打包（已推送 17f54c1）

## 本轮已完成
- **P2-10 网格直删入口（核验既有实现）**：
  - `CardItem` 悬浮胶囊 `absolute right-2 top-2` 内 `text-rust` 删除按钮（`onDelete` prop，`!readonly` 才渲染，`stopPropagation` 后调 `onDelete(id)`）
  - `page.tsx handleDeleteCard`：`settings.confirmDelete && !confirm` 二次确认（默认 true，可在设置中关闭），`snapshot` + `notifyWithUndo` 10s 撤销，`isDemoView` 时不传 `onDelete`（不显示按钮）
- **P2-11 批量管理（核验既有实现）**：
  - `bulkIds` Set + `CardItem` checkbox（`role="checkbox" aria-checked`，`bulkSelected/bulkActive/onBulkToggle`）+ 顶部批量操作栏（打标签/打星/导出/删除/取消选择）
  - `handleBulkDelete`：`confirm` 含数量 + `snapshot` 撤销栈；`handleBulkTag` prompt+parseTags+addCardTag 去重 ≤3；`handleBulkRate` 0-5 校验；`handleBulkExport` 筛选导出 Markdown

## 涉及文件
- 核验既有：`src/components/CardItem.tsx`（胶囊+checkbox+删除）、`src/app/page.tsx:490-662`（handleDeleteCard/handleBulk*）、`src/lib/storage.ts`/`types.ts`（confirmDelete）
- 文档：`docs/qa/BUGS.md`（P2-10/P2-11 12项 PASS）、`docs/review/PRODUCT_BACKLOG.md`（P2-10/P2-11 产品验收 PASS）、`docs/qa/QA_CHECKLIST.md`（12项打勾）、`docs/progress/CURRENT_STAGE.md`（本文件）、`docs/pm/PLAN.md`（已收口）、`docs/handoff/HANDOFF.md`、`AGENTS.md`、`README.md`

## 自测
- `npx tsc --noEmit`：零错误
- `npm run lint`：零错误零警告
- **P2-10 代码走查**：CardItem 胶囊删除按钮可见性（`bulkActive ? opacity-100 : group-hover:opacity-100`）、`onDelete` 仅非 readonly 渲染、demo 隐藏；`handleDeleteCard` confirm 文案「确定删除「{title}」？此操作不可撤销。」+ 三分支（filter+detailId+selectedId+bulkIds 清理）
- **P2-11 代码走查**：`bulkIds` Set 操作（toggleBulk add/delete）、CardItem checkbox `aria-checked`、批量栏「已选 N 张」+ 五按钮、批量删除 confirm + `notifyWithUndo` + 10s 撤销

## 架构决策（与原方案的偏差说明）
- 以下为 P0 标签系统基线决策，本轮沿用未变：
  - **「服务端 mutation 封装」落地方式**：客户端调用 `src/lib/tags.ts` 纯函数保证安全语义，随 cards 全量推送到服务端；serverStore 落盘前用守卫过滤 + 完整性校验做纵深防御。
  - **多标签上限 3 个保持不变**：待产品决策，未动多处 slice(0,3)。
  - **Card.tags 保留（方案 A 双写）**：Card.tags 冗余字段与 promptTags+tags 同步维护（syncCardsToPromptTags 统一重建），isCard 校验不变、旧客户端/导出/离线兜底兼容。
  - **demo 视图无 tag 实体**：用 deriveTagsFromCards(DEMO_CARDS) 派生临时 tags/promptTags，TagPanel 只读无管理入口。

## 给下一角色的技术交接要点
- QA 重点（P1-1 文案）：
  - 在线态 TagPanel 底部显示「已开启局域网实时同步（服务端共享存储），离线时回退本机缓存」
  - 停掉 dev-server（或断网）后刷新显示「未连接同步服务，已使用本机本地数据」
- QA 重点（P1-2 草稿不丢）：
  - 详情弹窗改标题/正文后光标不失焦直接按 Esc / 点蒙层 / 点「关闭」→ 数据已保存（不丢失）
  - 右侧面板移动端「收起」前有未失焦修改 → 收起后再次打开数据仍在
  - 快速输入备注后 700ms 内切换卡片 / 关闭弹窗 → 备注不丢、不串卡
- QA 重点（P1-3 导入）：
  - 文件选择器可选中 `.md` 文件并成功导入（导出 Markdown → 再导入可逆）
  - `accept` 含 `.json,.md,application/json,text/markdown`
- QA 重点（P1-4 冲突语义）：
  - 详情弹窗同时改标题与调取码且调取码与其他卡冲突 → 标题保存、调取码跳过、toast「调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试」
  - 右侧面板同样操作 → 行为一致
- 回归：P0 标签系统 22 项不破坏（树/筛选/CRUD/迁移 11/55/0 孤儿）；实时同步、失焦自动保存、版本、搜索、批量管理等既有能力不受影响
- 风险：无已知阻断；P1-2 关闭时 commitSave 可能触发一次静默保存 toast（冲突场景），属预期反馈

## 已收口，产品验收完成（2026-08-28，P2-10/P2-11 网格直删+批量管理 — QA 12项 + 产品验收 PASS）

- QA（2026-08-28）：P2-10/P2-11 12项 ALL PASS（删除按钮可见性/确认/移除 + demo 隐藏 + 多选框/批量栏/批量删除确认执行撤销/取消选择 + 打标签/打星/导出；tsc 0/lint 0；API 33→32）
- 产品验收（2026-08-28）：P2-10 网格直删（hover 胶囊 text-rust 删除 + confirm）+ P2-11 批量管理（checkbox + 已选 N 张 + 打标签/打星/导出/删除/撤销/取消）6 维度 PASS
- 待工程收尾提交推送。