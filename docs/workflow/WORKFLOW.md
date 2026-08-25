# 人工编排工作流 ｜ WORKFLOW

> 权威位置：`docs/workflow/WORKFLOW.md`
> 协作方法论基线：ORCA 人工编排多 Agent 治理体系 V2.1

本文件描述本项目的「人工编排」节奏与入口，供各 Agent 在启动时对齐。详细质量门控见 `QUALITY_GATES.md`，收尾 / 验收门控见 `CLOSEOUT_GATES.md`。

## 日常入口

- `【开发】`：Builder 进入开发 / 修复 / 调查
- `【节奏】`：用户触发 Stage Manager，由它判断下一步
- `【经验】`：把开发经验交给 Experience Recorder 记录

## 职责链

```
Builder（开发 + 技术交接材料 + CURRENT_STAGE）
  ↓
用户【节奏】
  ↓
Stage Manager（只读判断，生成“当前唯一执行 Prompt”）
  ↓
用户复制给下一 Agent 执行
```

## 关键原则

- 用户本人是唯一编排者；任何 Agent 不得自行调用下一 Agent 或替用户做流程决策。
- Stage Manager 本轮不得修改任何项目文件（包括 PLAN / CURRENT_STAGE / HANDOFF），只生成给 Builder 的执行 Prompt。
- Builder 是 `PLAN.md` 的日常维护者；Planner 仅用于首次 / 重大重新规划。
