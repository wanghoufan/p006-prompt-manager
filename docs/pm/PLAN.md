# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 本轮由 Builder 合并执行规划 + 开发（用户已确认合并角色），基线 commit `27bfe76`。

## 当前目标

本轮 **8 合 1 打包（P0-6 高亮二次优化 + P2-6/P2-7/P3-4/P3-5 + P2-1/P2-5/P2-11）**，纯前端 / 轻量逻辑，无新依赖：

1. **P0-6 高亮二次优化**：亮色 `bg-amber-300 + text-amber-950 + ring` 深字强描边；暗色 `bg-amber-400 + text-ink-950 + ring + 外发光` 最强对比；调 `globals.css --color-highlight*` 四变量，`<mark>` 加 `px-[1px] rounded-[3px] shadow`；WCAG AA ≥4.5:1。
2. **P2-6 评分守卫**：全局 `keydown` 在 `detailId || showSettings` 时屏蔽 `1-5/0` 评分
3. **P2-7 空/离线区分**：空状态常驻同步态横幅（在线/离线/迁移中）+ 离线重试
4. **P3-4 Composer 自适应**：`textarea` autoResize 至 `maxRows=6`
5. **P3-5 导入反馈加强**：`parseImport` 报告跳过原因，Toast 显示详情列表
6. **P2-1 版本节流**：失焦仅保存不建版，仅显式保存建版（已在 44c4a3a 实现，本轮验证收口）
7. **P2-5 撤销栈**：删除/清空/导入/载入示例 4 类操作 Toast 10s 撤销
8. **P2-11 批量管理**：CardItem 多选 checkbox + 顶部批量栏（标签/星/导出/删除，复用撤销）

## 验收标准

- **P0-6**：亮/暗各搜 `qa` 高亮对比达标，文本对比 ≥4.5:1，首屏 1s 可定位
- **P2-6**：弹窗打开时按数字不误评背景卡
- **P2-7**：空库时显示同步离线/连接中/已连接横幅
- **P3-4**：粘贴长文自动展开至 6 行
- **P3-5**：导入 Toast 显示成功/跳过数 + 跳过原因详情
- **P2-1**：失焦不建版，仅保存/ Ctrl+Enter 建版
- **P2-5**：危险操作后 10s 内可撤销
- **P2-11**：批量多选与批量操作生效
- 既有回归不破坏；`tsc --noEmit` / `lint` 零错误

## 实施方案

- **P0-6**：`globals.css` 三变量 + `CardItem.tsx` mark 样式；`P2-6` `page.tsx` keydown 守卫；`P2-7` `page.tsx` connect() + 空状态横幅；`P3-4` `Composer.tsx` autoResize；`P3-5` `storage.ts` skipped + `Toast` detail；`P2-1` 验证收口不改码；`P2-5` `Toast` action + `undoRef`；`P2-11` `bulkIds` + 批量栏

## 进行中 / 待办

- 本轮 8 项：P0-6 / P2-6 / P2-7 / P3-4 / P3-5 / P2-1 / P2-5 / P2-11，完成后待【节奏】触发 QA 验收。
- 不在本轮范围：P2-3 `<md` 面板降级、P3-2 版本 diff 等，见 `docs/review/PRODUCT_BACKLOG.md`。

---

## 已收口（2026-08-27，P0-4/P0-5 两项打包，commit 10bd764）

- P0-4/P0-5 已交付并通过 QA 第八次与产品 PASS（P0-6 待优化），commit `10bd764`。

## 已收口（2026-08-27，P0-1/P0-2/P0-3 三项打包）

- P0-1~3 已交付并通过 QA 第七次与产品 PASS，详见历史。

## 已收口（2026-08-26，P2-8/P2-9/P3-6 三项打包）

- P2-8/9/P3-6 已交付并通过 QA 第六次与产品 PASS。

## 已收口（2026-08-26，commit bef563f）

- 搜索 + 健壮性批次 A+B 已交付并通过 QA PASS / 产品验收 PASS。
