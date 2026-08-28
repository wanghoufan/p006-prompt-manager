# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder
> 基线：ORCA V2.1 §3

## 当前阶段
- Stage：P1 产品缺陷 4 项打包（2026-08-28；P1-1~P1-4，低成本单工位闭环；对齐 PRODUCT_BACKLOG P1 段）
- 完成度：实现 100%；自测 100%（tsc 0 / lint 0）
- 风险等级：L0（无阻断）；纯文案 + 关闭前 flush 兜底，无新依赖，改动面小
- 基线：上一阶段 P0-8 标签重命名（已交付待 QA）

## 本轮已完成
- **P1-1 TagPanel 底部文案与实际同步架构一致**：
  - 在线态（`serverOnline===true`）：「已开启局域网实时同步（服务端共享存储），离线时回退本机缓存」
  - 离线态（`offline` prop = `serverOnline===false`）：「未连接同步服务，已使用本机本地数据」
  - 消除原「数据仅存于本机浏览器」误导，与 README / HANDOFF / CURRENT_STAGE 所述「服务端 `data/store.json` 为同步源 + localStorage 离线兜底 + SSE 实时同步」一致
- **P1-2 关闭/切卡不再静默丢稿**：
  - CardDetail `handleClose`（既有）：Esc / 蒙层 / 关闭按钮先 `clearTimeout(notesTimer)` + `commitSave(true)` 再 `onClose`
  - PreviewPanel（本次新增 `handleClose`）：移动端抽屉「收起」先 flush 未保存草稿再 `onClose?.()`（此前直接 `onClose`，靠卸载兜底）
  - 切换选中卡片：`key={previewCard?.id}` 重挂 + 卸载 effect `saveThrough(true,true)` 兜底
  - 两组件卸载 effect 均 `clearTimeout(notesTimer)` + abort AI 请求 + flush；备注定时器不再泄漏
- **P1-3 导入选择器支持 .md**（核验既有实现，无需改动）：
  - `TopBar.tsx:70` `accept=".json,.md,application/json,text/markdown"`，按钮 `title`「导入备份（支持 JSON 与 Markdown）」
  - 与 `buildMarkdownExport`（导出 .md）+ `parseImport`（支持 Markdown 回导）形成可逆闭环
- **P1-4 调取码冲突语义统一**（核验既有实现，无需改动）：
  - CardDetail `saveThrough` 与 PreviewPanel 一致：冲突时「跳过 code 字段、其余字段照存」
  - 冲突常驻提示「该调取码已被其他卡片使用，请更换」+ 保存 toast「调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试」
  - 两处行为不再分叉（Detail 不再整单阻断保存）

## 涉及文件
- 修改：`src/components/TagPanel.tsx`（底部文案两行）、`src/components/PreviewPanel.tsx`（新增 handleClose + 收起按钮接入）
- 核验既有：`src/components/TopBar.tsx`（accept/title）、`src/components/CardDetail.tsx`（handleClose/卸载清理/冲突跳过）
- 文档：`docs/pm/PLAN.md`（P1 四段）、`docs/progress/CURRENT_STAGE.md`（本文件）

## 自测
- `npx tsc --noEmit`：零错误
- `npm run lint`：零错误零警告
- **P1-1 文案核对**：TagPanel 在线/离线两分支文案与需求逐字一致；`offline` prop 由 `page.tsx:770` `serverOnline===false` 传入
- **P1-2 代码走查**：CardDetail.handleClose（Esc/蒙层/关闭）先 flush；PreviewPanel.handleClose 先 flush 再收起；两组件卸载 effect `clearTimeout(notesTimer)` + `saveThrough(true,true)`；`key={previewCard?.id}` 切卡重挂兜底
- **P1-3 代码走查**：TopBar accept 已含 `.md` + MIME；导入路径 `page.tsx handleImportFile → parseImport` 支持 Markdown
- **P1-4 代码走查**：CardDetail.tsx:126 与 PreviewPanel.tsx:199 均为「`codeChanged && !conflict` 才 onUpdateCode」，冲突时其余字段照存，toast 文案一致

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

## 已收口，产品验收完成（2026-08-28，P1 产品缺陷 4 项打包 — QA 第十六次 + 产品验收 PASS）

- QA 第十六次（2026-08-28）：P1-1~P1-4 4项 ALL PASS（tsc 0/lint 0，无新增 Bug）
- 产品验收（2026-08-28）：文案与架构一致 + 关闭不丢稿全路径 + 导入 .md 可逆 + 冲突统一「跳过 code、其余照存」4项 PASS
- 待工程收尾提交推送。