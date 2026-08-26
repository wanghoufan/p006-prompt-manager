# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> 上一轮 11 合 1 已交付（基线 commit `2e7b635`）。本轮 2 合 1：**P0-6 高亮重开整改（2026-08-28）+ P0-7 卡片空白回收**，纯前端 / 轻量逻辑，无新依赖。

## 当前目标

1. **P0-6 高亮关键字被遮挡重开（2026-08-28 最新截图）**：根因 `mark` 误用 `text-highlight` 类（解析为 `--color-highlight` 琥珀色 → 文字与背景同色完全被覆盖）；修复后 mark 文字固定取 `--color-highlight-text`（亮=深棕 #451a03 / 暗=黑 #111）。
   - **亮色**：半透明浅黄 50%（color-mix）+ 深棕字 + amber-600/50 描边 + font-medium → 对比 ≈12.5:1（WCAG AA ✓✓）
   - **暗色**：amber-400 实底 + 黑字 + amber-300/60 描边 + 外发光 → 对比 ≈11.3:1（WCAG AA ✓✓）
   - **取舍说明**：暗色若按 50% 半透明，混合底色被深卡拖暗，黑字对比仅 ≈3.7:1 不达 AA；故暗色采用实底 + 外发光（荧光笔黑字），符合「暗色黑字在深底最突出」的硬验收。
2. **P0-7 卡片网格加入删除键后中间空白过大**：
   - 操作列（多选 ✓ / 编辑 / 删除）改为 **absolute top-2 right-2 悬浮胶囊**（`bg-ink-900/80 backdrop-blur` 圆角边框 + `group-hover`/`bulkActive`/`focus-within` 显隐），不占文档流
   - 标题行容器加 `pr-16`（64px）预留胶囊位，code 徽标不被胶囊盖
   - 正文 `line-clamp-2` → `line-clamp-3`，回收操作列占用的纵向空间
   - 卡片总高度不变或更紧凑，单卡可视信息密度提升

## 验收标准

- P0-6：亮/暗各搜「qa」后截图，命中文字清晰可读不被遮挡（实测 ✓），WCAG AA ≥4.5:1（实测亮 12.5:1 / 暗 11.3:1）
- P0-7：同数据对比截图，单卡正文可视行 2-3 行（实测 ✓），空白回收，hover 时操作仍可达（实测悬浮胶囊可见 ✓ 编辑 删除）
- `tsc --noEmit` 零错误 ✓；`npm run lint` 零错误 ✓（修复 `.worktrees/**` ignore）
- 既有 11 项回归不破坏

## 实施方案

- `globals.css`：微调 `--color-highlight-ring` 暗色值对齐 amber-300/60；新增 `mark` 元素选择器样式（亮/暗分主题，背景用 var / color-mix 双轨）
- `CardItem.tsx`：mark className 简化（样式已移入 globals.css）；顶部行容器加 `pr-16`；操作列 div 改为 absolute 悬浮胶囊 + bulkActive/focus-within 显隐；正文 line-clamp-2 → line-clamp-3
- `eslint.config.mjs`：`globalIgnores` 增加 `.worktrees/**`（git worktree 构建产物，`.next` 同类缓存，不扫描）

## 进行中 / 待办

- 本轮 2 项完成，待【节奏】触发 QA 验收（11合1 总验收收口）

---

## 已收口（2026-08-28，P0-6 重开 + P0-7 两项打包）

- P0-6 修复 mark 类名根因 + 亮/暗高对比调优；P0-7 操作列悬浮胶囊化 + 正文 3 行
- 涉及文件：src/components/CardItem.tsx、src/app/globals.css、eslint.config.mjs
- 浏览器实测截图：scratch/p06-light-qa-v2.png（亮色 qa 高亮）、p06-dark-qa-final.png（暗色 qa 高亮）、p07-dark-grid.png（暗色默认网格，对比亮色同样布局紧凑）

## 已收口（2026-08-27，commit 2e7b635）

- 11 合 1（P0-6 高亮二次优化 + P2-6/P2-7/P3-4/P3-5 + P2-1/P2-5/P2-11 + P2-3/P2-4/P3-2）已交付并通过 QA / 产品 PASS。
