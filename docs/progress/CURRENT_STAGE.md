# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder（每个可独立收尾阶段结束后更新）
> 基线：ORCA 治理体系 V2.1 §3

> 本文件是 Builder 的「技术交接材料」载体，供 Stage Manager 判断下一步。只维护当前阶段，不按日期无限累积。

## 当前阶段
- Stage：P0/P1 缺陷修复轮（8 项）收尾
- 完成度：修复侧 100%（8 项全部落地并自测）；质量侧 100%（tsc / lint / MCP build 通过，API 级 QA PASS，GUI 人工确认通过）
- 风险等级：L0（无阻断性风险）；剩余 P2/P3 与架构类风险（RISK-1/2/3/5）见下，均不阻断交付

## 本轮已完成
- **渲染期 ref 赋值修复（P0）**：`PreviewPanel` / `CardDetail` 的 `draftRef.current = draft` 改为 `useEffect` 同步，消除 React Hooks 违规与陈旧 ref 读取风险（lint 0 error）。
- **正文失焦不再生成版本快照（P1）**：`cards.ts` 拆分 `saveBodyOnly`（仅存正文）与 `saveBodyWithVersion`（存正文+建版）；失焦自动保存仅落正文，版本仅由手动保存 / Ctrl(⌘)+Enter 触发；`bodyDirtyRef` 保证「改正文后点保存」仍正常建版。
- **同步推送串行化（P1）**：`storage.ts` `schedulePush` 改为 `pushInFlight` + `pushPending` 队列，推送中收到新变更标记 pending、完成后补推最新状态，高频改动最终一致、不丢中间态。
- **全局评分快捷键守卫（P1）**：`page.tsx` 全局 keydown 在 `detailId` / `showSettings` 开启时直接 return，弹窗聚焦按钮按 1-5 不再误评背景卡。
- **TagPanel 文案失实（P1）**：底部文案改为「局域网实时同步（服务端共享存储），离线回退本机缓存」，新增 `offline` prop 区分离线态提示。
- **关闭/切卡丢稿 + 备注定时器泄漏（P1，合并 RISK-4）**：PreviewPanel 卸载 cleanup flush 未保存草稿 + `clearTimeout(notesTimer)`；CardDetail `handleClose`（Esc / 蒙层 / 关闭 / 取消）先 `commitSave` 再关闭，卸载 cleanup 兜底。
- **导入选择器（P1）**：`TopBar` `accept` 扩展为 `.json,.md,application/json,text/markdown`，按钮 title 注明支持 JSON 与 Markdown。
- **调取码冲突语义统一（P1）**：CardDetail 对齐 PreviewPanel「跳过冲突字段、其余照存」；静默（失焦）保存遇冲突也给出可见 toast 提示。
- 附带清理：删除仓库根目录垃圾目录 `opencode --auto -m opencode/`（仅含空文件）。

## 涉及文件
- 功能：`src/components/PreviewPanel.tsx`、`src/components/CardDetail.tsx`、`src/components/TagPanel.tsx`、`src/components/TopBar.tsx`、`src/app/page.tsx`、`src/lib/cards.ts`、`src/lib/storage.ts`
- 文档：`docs/qa/BUGS.md`（BUG-7 修复状态）、本文件、`docs/handoff/HANDOFF.md`、`AGENTS.md`（档案状态行）

## 自测
- `npx tsc --noEmit`：零错误。
- `npm run lint`：零错误。
- MCP 子包 `npm run build`：通过。
- API 级 QA：结论 PASS（CRUD / 同步 / 数据结构完整性）。
- GUI 人工确认：通过（7 项核验：失焦不建版/保存建版、连改两卡服务端一致、弹窗不误评分、Esc 关闭保留内容、备注切卡不错卡、导出 md 导入还原、双卡同码冲突语义）。
- 测试数据已还原（`data/store.json` 备份恢复 + dev 服务重启）。

## 风险 / 未验证
- 剩余架构/规范类风险（未修，不阻断交付，建议单独排期）：
  - RISK-1：MCP 直读 `data/store.json` 可能拿到陈旧数据（建议 MCP 改走 HTTP 读取）。
  - RISK-2：MCP 计数 fire-and-forget，失败静默导致 copyCount 少计。
  - RISK-3：AI 请求缺 AbortController，卸载后仍可能 setState。
  - RISK-5：调取码冲突自动保存提示已补（本轮修复 8），剩余「冲突检测时机」边缘场景可继续观察。
- P2 / P3 候选未处理：见 `docs/review/PRODUCT_BACKLOG.md`（P2：全局搜索、预览面板 `<md` 适配、危险操作撤销、空态/离线态区分等；P3：输入计数反馈、版本 diff、快捷键可发现性等）。

## 给下一角色的技术交接要点
- QA 重点：失焦自动保存与建版的分流路径（`commitSave(silent)` / `saveThrough` / `bodyDirtyRef`）；备注 700ms 防抖 + 卸载 flush。
- 技术风险：无阻断项。
- 潜在回归：正文「失焦不建版」改变了版本生成时机，需确认用户对版本语义的预期；`saveBodyWithVersion` 移除了同 body 早退，仅手动保存路径可达。
- 可能需要 Review 的核心区域：`PreviewPanel.tsx` / `CardDetail.tsx` 的 `saveThrough` 统一保存逻辑、`storage.ts` 的推送队列。
- 可能需要 Product / Visual 关注的变化：TagPanel 底部同步态文案、导入按钮 title。

## 建议下一步
- 提交并推送本轮（8 项修复 + 4 份报告/QA 文档 + 2 份收口文档 + AGENTS 状态行）——需用户明确授权。
- 进入视觉验收 / 产品验收（Visual / Product Acceptance）→ neat-freak 里程碑收尾（Full Milestone Closeout）。
