# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder
> 基线：ORCA V2.1 §3

## 当前阶段
- Stage：2 合 1（P0-6 高亮重开整改 + P0-7 卡片空白回收），2026-08-28 用户最新反馈
- 完成度：实现 100%；自测 100%（tsc 0 / lint 0 / 浏览器亮暗双主题实测通过）
- 风险等级：L0（无阻断）；纯前端 / 轻量逻辑，无新依赖
- 基线：上一阶段 11 合 1（2e7b635，QA 总验收 / 产品 PASS）

## 本轮已完成
- **P0-6**：mark 类名根因修复（text-highlight → CSS var --color-highlight-text）+ 亮色半透明浅黄+深棕字 + 暗色 amber-400 实底+黑字外发光
- **P0-7**：操作列改 absolute top-2 right-2 悬浮胶囊（bg-ink-900/80 backdrop-blur，group-hover/focus-within/bulkActive 显隐）+ 正文 line-clamp 3 + 标题行 pr-16 让位
- 涉及文件：src/components/CardItem.tsx、src/app/globals.css、eslint.config.mjs（.worktrees/** 加入 ignore 让 lint 干净）
- 文档：docs/pm/PLAN.md（本轮 2 合 1 段）、本文件
- 浏览器实测截图（亮/暗 qa 双主题）：scratch/p06-light-qa-v2.png、scratch/p06-dark-qa-final.png

## 自测
- `npx tsc --noEmit`：零错误
- `npm run lint`：零错误（修复 `.worktrees/**` 被 lint 扫的存量问题）
- 浏览器手测（agent-browser Chromium @ localhost:3000）：
  - 亮色搜「qa」→ 16 命中，mark「qa/QA」深棕字+半透明浅黄底清晰可读，对比 ≈12.5:1
  - 暗色搜「qa」→ 16 命中，mark「qa/QA」黑字+amber-400 实底+外发光极清晰，对比 ≈11.3:1
  - 卡片正文 2→3 行可见，操作胶囊 hover/focus 显示（实测 ✓ 编辑 删除）
  - code 徽标不被胶囊盖住（pr-16 预留位生效）

## 风险 / 未验证

- 取舍说明：暗色 mark 用 amber-400 实底（非 50% 半透明），因 50% 半透明叠深卡会让黑字对比仅 ≈3.7:1 不达 WCAG AA。此取舍在 globals.css 与 PLAN.md 注释中明确标注，符合「暗色黑字在深底最突出」的硬验收
- QA 待总验收

## 给下一角色的技术交接要点

- QA 重点：① P0-6 双主题搜「qa」截图对比，确认文字清晰可读不被遮挡；② P0-7 卡片正文行数 + 操作胶囊 hover 显隐 + code 徽标不被盖
- 验收参考截图：scratch/p06-light-qa-v2.png、scratch/p06-dark-qa-final.png、scratch/p07-dark-grid.png
- 建议下一步：等待 QA Acceptance（2 合 1 总验收）→ 产品验收 → Closeout

## 已收口，待 QA 验收（2026-08-28，P0-6 重开 + P0-7 打包）
- 本轮 2 项已交付，待总验收。

## 已收口，待 QA 验收（2026-08-27，11 合 1，commit 2e7b635）
- 上一阶段 11 项已交付并通过 QA / 产品 PASS。
