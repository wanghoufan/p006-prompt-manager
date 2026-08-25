# 收尾与验收门控 ｜ CLOSEOUT_GATES

> 权威位置：`docs/workflow/CLOSEOUT_GATES.md`
> 基线：ORCA 治理体系 V2.1 §11

六类收尾，按当前阶段组合，不新增角色。

## A. Engineering Closeout
执行：neat-freak（优先用 neat-freak Skill 作为能力层；本仓库规范以 `docs/roles/neat-freak.md` 为准）。
不得扩展去做 QA / Product / Visual。

## B. QA Acceptance
执行：QA 的 `【QA验收】` 模式。

## C. Visual Acceptance
执行：Product Reviewer 的 `【视觉验收】` 模式。硬要求 Vision + Computer Use。

## D. Product Acceptance
执行：Product Reviewer 的 `【产品验收】` 模式。必须输出 PASS / PARTIAL / FAIL + 阻断项。

## E. Context / Handoff Closeout
执行：Builder，根据 Stage Manager 的 `【阶段收口】` Prompt，更新 `docs/handoff/HANDOFF.md`。

## F. Full Milestone Closeout
不是新角色，是 Stage Manager 组合上述已有模式。

## HANDOFF 与【整理】分工
- `docs/handoff/HANDOFF.md`：Repo 内固定的最新正式交接状态（只维护一个最新版本）。
- `【整理】`：项目外导出的、带版本号的新会话交接文档（换平台 / 新 Agent 无法直接读取 Repo 时使用）。
