# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 本轮 11 合 1 打包（P0-6 高亮二次优化 + P2-6/P2-7/P3-4/P3-5 + P2-1/P2-5/P2-11 + P2-3/P2-4/P3-2），基线 commit `27bfe76`，纯前端 / 轻量逻辑，无新依赖。

## 当前目标

1. **P0-6 高亮二次优化**：亮/暗双主题高对比二次调优（亮色深字+强描边，暗色黑字+外发光），WCAG AA ≥4.5:1
2. **P2-6 评分守卫**：`detailId || showSettings` 时屏蔽全局评分
3. **P2-7 空/离线区分**：空状态横幅（在线/离线/迁移中）
4. **P3-4 Composer 自适应**：`maxRows=6` autoResize
5. **P3-5 导入反馈加强**：报告跳过原因详情
6. **P2-1 版本节流**：失焦仅保存不建版（验证收口，已在 44c4a3a 实现）
7. **P2-5 撤销栈**：4 类危险操作 10s 撤销
8. **P2-11 批量管理**：多选 checkbox + 批量栏
9. **P2-3 移动端抽屉**：`<md` 时预览面板为底部抽屉
10. **P2-4 备注防丢**：`notesTimer` cleanup + 切卡 flush
11. **P3-2 版本 diff**：版本行展开 diff 高亮

## 验收标准

- 11 项各自按 PRODUCT_BACKLOG 定义通过；既有回归不破坏；`tsc`/`lint` 零错误

## 实施方案

- `globals.css` 高亮变量 + `CardItem` mark；`page.tsx` keydown 守卫 + connect() + 空横幅；`Composer` autoResize；`storage` skipped + `Toast` detail；`cards` 验证收口；`Toast` action + `undoRef`；`bulkIds` 批量；`PreviewPanel` 抽屉 + `onClose`；`notesTimer` cleanup；`VersionDiff` diff

## 进行中 / 待办

- 本轮 11 项，完成后待【节奏】触发 QA 验收（总验收）。

---

## 已收口（2026-08-27，P0-4/P0-5 两项打包，commit 10bd764）

- P0-4/P0-5 已交付并通过 QA 第八次与产品 PASS。

## 已收口（2026-08-27，P0-1/P0-2/P0-3 三项打包）

- P0-1~3 已交付并通过 QA 第七次与产品 PASS。

## 已收口（2026-08-26，P2-8/P2-9/P3-6 三项打包）

- P2-8/9/P3-6 已交付并通过 QA 第六次与产品 PASS。

## 已收口（2026-08-26，commit bef563f）

- 搜索 + 健壮性批次 A+B 已交付。
