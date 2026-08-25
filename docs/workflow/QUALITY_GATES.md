# 风险触发式质量门控 ｜ QUALITY_GATES

> 权威位置：`docs/workflow/QUALITY_GATES.md`
> 基线：ORCA 治理体系 V2.1 §7

按风险选择质量动作，不机械执行所有角色。

## L0 ｜ 微小改动
Builder 自测即可；一般不 QA / Review / Product。

## L1 ｜ 局部功能 / 小修改
- 可操作行为变化 → QA
- 技术风险明显 → Code Review
- 体验变化明显 → Product Review

## L2 ｜ Feature Slice
形成可操作闭环：
- QA 通常建议
- Review 按技术风险
- Product 按产品成熟度 / UX 风险

## L3 ｜ MVP / Release / 大 Stage
由 Stage Manager 规划完整质量和收尾路线。

## Fix 默认优先级
1. Code Review P0 / P1
2. QA 可复现 P0 / P1
3. Product / Visual P1
4. 用户本轮明确指定问题

默认不自动开发 Review / Product 的 P2 / P3 / Future，除非用户批准或已进入当前 PLAN。
