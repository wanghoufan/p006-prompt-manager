# 当前开发阶段 ｜ CURRENT_STAGE

> 权威位置：`docs/progress/CURRENT_STAGE.md`
> 维护者：Builder（每个可独立收尾阶段结束后更新）
> 基线：ORCA 治理体系 V2.1 §3

> 本文件是 Builder 的「技术交接材料」载体，供 Stage Manager 判断下一步。只维护当前阶段，不按日期无限累积。

## 当前阶段
- Stage：P2-8 / P2-9 / P3-6 三项打包
- 完成度：实现 100%；自测 100%（tsc 0 错误 / lint 0 错误 / 浏览器手测关键路径全部通过）
- 风险等级：L0（无阻断性风险）；纯前端 / 轻量逻辑，无新依赖

## 本轮已完成

### P2-8 搜索结果按相关度排序（标题命中优先）
- **位置**：`src/app/page.tsx` 模块级新增 `relevanceScore(c, term)`（title=4 / code=3 / tag=3 / notes=2 / body=1，命中取最高分）与 `compareBySortMode(a, b, mode)`（抽出现有三分支 sortMode 比较逻辑）。
- **`visibleCards` 排序分支**：`searchActive && !searchTerm.startsWith('@')` 时先按 score desc 排序、同分再按 sortMode 二级排序；`@code` 直达模式与无搜索时维持原 sortMode。
- **Bug 修复**：首版 `relevanceScore` 未对 term 小写化（搜索过滤用 `toLowerCase()`，但打分传入原始大写 "QA"），导致 title 命中判定失败。已在函数内 `const t = term.toLowerCase()` 修正。
- **验证**：搜「QA」时 5 张标题含 QA 的卡（执行QA验收检查 / QA测试执行与Bug记录 / 建立QA基线并更新检查清单 / QA后按规则恢复 / 汇总QA审核结论）全部排前 5（score=4），正文命中卡靠后；小写「qa」同样命中（大小写不敏感）；`@jbyj` 命中 1 张（@code 隔离保持）；清空搜索后「开发节奏与质量门控决策助手」排第一（无搜索时按 sortMode 恢复）。

### P2-9 左侧标签管理（删除标签 = 批量从卡片移除）
- **位置**：`src/components/TagPanel.tsx` 新增可选 `onDeleteTag` prop；TagRow 重构为 div 容器（避免 button 嵌套），主按钮 flex-1 + 右侧 hover 显示 ×（`group-hover:opacity-100` + `focus-visible:opacity-100`，键盘可达）。
- **`page.tsx` `handleDeleteTag`**：按 `cards` 统计含该标签卡片数 → `window.confirm「将从 N 张卡片中移除标签「X」，卡片本身不会删除」` → `setCards(prev => prev.map(c => c.tags.includes(tag) ? { ...c, tags: c.tags.filter(t => t !== tag) } : c))`（复用现有 cards 落盘 + SSE 同步链）；被删标签为当前选中项时顺带取消选中；demo 视图不传 `onDeleteTag`（readonly）。
- **验证**：选「toke」标签（1 张卡）点击 × → confirm → 标签从「定点读取交接信息」卡移除（tags 由 `['toke', '开发恢复', '多age']` 变为 `['开发恢复', '多age']`），左侧「toke」标签自动消失，全部 31 张卡总数不变（只删标签不删卡、原文不动）；标签总数 16 → 15。

### P3-6 保存时自动规范化正文格式（左对齐风格）
- **位置**：`src/lib/cards.ts` 新增 `normalizeBody(body)`，在 `saveBodyOnly` / `saveBodyWithVersion` 入口统一调用（`saveBodyOnly` 的 `===` 短路比较在 normalize 之后进行）；`src/lib/storage.ts` 的 `parseImport`（JSON 路径 `.map(c => ({...c, body: normalizeBody(c.body)}))`）与 `parseMarkdownImport`（`flush()` 内 `normalizeBody(current.body.join('\n'))`）导入卡片 body 同步调用，保证导入与新建一致。
- **规则**：① 逐行去前导 tab；② 纯空白行归一为空行；③ 非空行前导空格保留最多 4 个（超过部分 collapse），避免破坏 Markdown 列表 / 代码块缩进；④ 去首尾空行（slice 头尾空行而非 `trim()`，保留首行 4 空格缩进）；⑤ 合并连续空行（`\n{3,}` → `\n\n`，最多保留 1 个空行）。
- **验证**：在 PreviewPanel 改「测试语音输入法效果」body 为带 tab / 多余空格的测试内容并 blur 保存后查 `data/store.json` 落盘：所有前导 tab 全去（如「\t\t\t深缩进」→「深缩进」）；6 空格行 → 4 空格（「       6空格子项」→「    6空格子项」）；8 空格行 → 4 空格；2 空格行保留 2 空格；连续空行（`\n\n\n\n`）合并为单空行（`\n\n`）。手测后已恢复测试卡原 body 并重启 dev server 让 serverStore 重新从文件加载。

## 涉及文件
- 修改：`src/app/page.tsx`（P2-8 relevanceScore / compareBySortMode / visibleCards 排序分支 / handleDeleteTag / TagPanel onDeleteTag 传入）、`src/components/TagPanel.tsx`（TagRow 重构 + onDeleteTag prop）、`src/lib/cards.ts`（normalizeBody + saveBodyOnly / saveBodyWithVersion 入口）、`src/lib/storage.ts`（import normalizeBody + parseImport / parseMarkdownImport 调用）
- 文档：`docs/pm/PLAN.md`（当前目标段覆盖为 P2-8/P2-9/P3-6）、本文件

## 自测
- `npx tsc --noEmit`：零错误。
- `npm run lint`：零错误。
- 浏览器手测（agent-browser Chromium，真机目检）：
  1. **P2-8 搜索「QA」**（截图 `scratch/manual-test/p28-search-qa.png`）：命中 16 / 共 31；前 5 张卡依次为「执行QA验收检查 / QA测试执行与Bug记录 / 建立QA基线并更新检查清单 / QA后按规则恢复 / 汇总QA审核结论」（标题含 QA，score=4），随后为「开发节奏与质量门控决策助手」等正文/标签命中卡（score=1）；命中关键词「QA」以金色 `<mark>` 高亮。
  2. **P2-8 大小写不敏感**：搜「qa」命中 16 张，顺序与「QA」一致。
  3. **P2-8 `@code` 隔离**：`@jbyj` 命中 1 张（开发经验记录Agent提示词），排序维持原 sortMode（@ 模式跳过相关度）。
  4. **P2-8 无搜索恢复 sortMode**：清空搜索后「开发节奏与质量门控决策助手」排第一。
  5. **P2-9 标签删除**：点击「toke」行 × → confirm → 「定点读取交接信息」tags 由 `['toke', '开发恢复', '多age']` 变为 `['开发恢复', '多age']`；左侧「toke」标签消失，全部 31 张卡总数不变；store.json JSON 校验通过。
  6. **P3-6 normalize**：测试卡 body 改测试内容 → blur → store.json 落盘：tab 全去、6/8 空格→4 空格、2 空格保留、连续空行合并、首尾空行去。手测后已恢复 body 并重启 dev server。
  7. **回归：失焦保存**：点 QA 卡片 → PreviewPanel title 改 + Tab blur → 角标「· 已自动保存」出现 + grid 标题同步更新。手测后已恢复原 title。
- 运行时数据：`data/store.json` 经 P3-6 测试短暂污染（已恢复测试卡 body）、P2-9 移除「toke」标签（已通过 confirm 授权）、回归 title 改回原值。已备份到 `scratch/store.json.bak-20260826-123001`，并按规范停服 → 改文件 → JSON 校验 → 重启 dev server 验证 HTTP 200 / `/api/sync` 200。

## 风险 / 未验证
- AbortController / SettingsModal 焦点闭环：未在本轮单独回归，代码路径未触碰（`PreviewPanel` / `CardDetail` / `Composer` 的 `*AbortRef` 与 `useModalFocus` 文件本轮未改），无破坏风险。
- normalizeBody 对粘贴的 4 空格代码块（Markdown fenced 缩进）保留 4 空格符合「保留 Markdown 合法缩进」原则，但未在真实代码块场景实测。
- 编辑 P3-6 测试期间，agent-browser 自动 dispatch 'input' 事件时 React 合成 onChange 的异步 setState 会让 draftRef 更新滞后于 dispatchEvent('blur')，故 P3-6 验证采用「真实键盘 type + Tab blur」完整 React 状态流而非 dispatchEvent 路径。

## 给下一角色的技术交接要点
- QA 重点：
  - P2-8：搜不同字段关键词（标题/正文/标签/调取码/备注）确认相关度排序；同分时切换 sortMode 验证二级排序；@code 模式。
  - P2-9：在含多张卡的标签上删除验证批量；空标签（cards.length===0 的边界）；demo 视图不显示 ×；带 confirm 取消分支。
  - P3-6：粘贴带 tab/多空格的真实场景（富文本、Markdown 模板、代码块）；极端案例（全 tab 行、超长缩进、CRLF）；导入路径（导出 Markdown → 重新导入 → body 应已 normalize）。
- 技术风险：无阻断项。
- 潜在回归：normalizeBody 改变了 saveBodyOnly 的 `===` 短路语义——若用户输入空字符串 normalize 后仍为空，`body === card.body` 为真时直接返回原卡（updatedAt 不变），与之前一致；若输入与原 body 字符串完全相同也会短路。无回归。

## 建议下一步
- 等待用户【节奏】触发 QA Acceptance。
- 本轮三项（实现 4 改 + 2 文档）需用户授权后 commit / push。

---

## 已收口，待 QA 验收（2026-08-26）

- 上一阶段（搜索 + 健壮性批次 A+B，commit `bef563f`）已交付并通过 QA PASS / 产品验收 PASS，详见历史版本。
- 当前阶段：P2-8 / P2-9 / P3-6 三项打包，实现 + Builder 自测完成；遗留 `data/store.json` 已恢复（测试卡 body 复原、toke 标签移除、回归 title 复原）。待 QA Acceptance。
