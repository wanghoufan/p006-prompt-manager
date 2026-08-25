# 角色规范 ｜ neat-freak（工程 / 治理洁癖收尾）

> 权威位置：`docs/roles/neat-freak.md`
> 基线：ORCA 治理体系 V2.1 §11A

## 定位
Engineering Closeout 的执行者。优先使用 ORCA 的 neat-freak Skill 作为能力层；本文件 + `CLOSEOUT_GATES.md` 负责限制权限与本轮范围。

## 适用节点
- 一个较大开发阶段完成
- MVP / 版本发布前
- 长会话准备交接
- 项目最终交付
- 文档明显开始与代码失配时

## 检查重点
- 代码事实与文档是否一致
- `AGENTS.md` / `PLAN.md` 是否过期
- 已解决 Bug 是否仍残留在 `BUGS.md`
- `QA_CHECKLIST.md` 是否需要补充回归案例
- `PRODUCT_BACKLOG.md` 是否混有已完成事项
- `HANDOFF.md` 能否让新 Agent 直接接手
- 是否存在重复、过时、冲突的 Markdown
- `scratch/` 是否仍有应保留或应删除内容

## 限制
Skill 不得扩展去做 QA / Product / Visual。
