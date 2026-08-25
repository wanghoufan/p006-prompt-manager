# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder（每个可独立收尾阶段结束后更新）
> 基线：ORCA 治理体系 V2.1 §3

> 本文件是 Builder 的「技术交接材料」载体，供 Stage Manager 判断下一步。只维护当前阶段，不按日期无限累积。

## 当前阶段
- Stage：MVP 功能打磨 + 治理规整（第 3 轮交互迭代收尾）
- 完成度：功能侧 100%（备注字段 + 自动保存已落地）；治理侧 100%（目录与骨架文档已对齐 ORCA V2.1 §20）
- 风险等级：L0（无阻断性风险，均已自测）

## 本轮已完成
- **备注字段（notes）**：新增 `Card.notes`（用户自填，非 AI 生成）；正文上方 2 行可拖动 textarea；只读态紧凑展示；Markdown 导入导出新增 `### 备注` 段；12 张示例卡预置 notes。
- **自动保存（失焦即存）**：标题 / 标签 / 调取码 / 备注 / 星级失焦即落地；备注边输入边存（停手 700ms 防抖）；正文失焦或 `Ctrl/⌘+Enter` 保存并生成版本；保存后底部「已自动保存」角标，手动保存按钮给「已保存」提示。对齐腾讯文档 / 飞书体验。
- **回滚 bug 修复**（上一轮已提交）：`rollbackToVersion` 不再对当前正文重复快照。
- **治理规整（ORCA V2.1）**：补齐 `docs/workflow/`、`docs/progress/`、`docs/optional/`、`docs/roles/` 缺失骨架文档；更新 `AGENTS.md` §四归属表与 §三角色索引。

## 涉及文件
- 功能：`src/lib/types.ts`、`src/lib/cards.ts`、`src/lib/storage.ts`、`src/lib/demo.ts`、`src/components/PreviewPanel.tsx`、`src/components/CardDetail.tsx`、`src/app/page.tsx`
- 文档：`README.md`（功能概览 / 使用指南 / 核心亮点新增备注与自动保存）、`AGENTS.md`、`docs/progress/CURRENT_STAGE.md`、`docs/workflow/*`、`docs/roles/*`、`docs/optional/*`、`docs/DEV_EXPERIENCE.md`

## 自测
- 类型检查 `npx tsc --noEmit` 通过。
- 备注字段：编辑 / 保存 / Markdown 导入导出往返正常。
- 自动保存：失焦各字段均静默落地并显示角标；正文失焦与手动保存均生成版本。
- 治理结构：25 个 ORCA 规定文件 / 目录就位，无断链。

## 风险 / 未验证
- 无阻断性风险。正文失焦也会生成版本快照（与手动保存一致），版本上限 10 条，长会话高频失焦可能较快占满版本列表——当前属可接受设计，如需「仅手动保存生成版本」可后续调整。

## 给下一角色的技术交接要点
- QA 重点：自动保存在各输入控件的触发时机（标题/标签/调取码/备注/星级失焦；备注 700ms 防抖）。
- 技术风险：无。
- 潜在回归：回滚语义已修复，需确认回滚不再产生重复版本记录。
- 可能需要 Review 的核心区域：`PreviewPanel.tsx` / `CardDetail.tsx` 的 `commitSave` 与 `handleSave` 分流逻辑。
- 可能需要 Product / Visual 关注的变化：备注区占用正文上方 2 行空间，正文优先比例仍维持约 80%。

## 建议下一步
- 提交本轮（备注字段 + 自动保存 + 治理规整）并推送。
- 视反馈决定是否调整「正文失焦也生成版本」的策略。
