# Bug 记录（BUGS）

> 当前未关闭 / 已确认的 Bug。由 QA 记录，开发更新修复状态。`【修复】` 优先处理 P0、P1；P2 / P3 / Future 默认不自动开发。

## 最近一次 QA 执行记录

- **日期**：2026-08-26（第六次 - P2-8/P2-9/P3-6 三项打包回归验收）
- **模式**：QA Acceptance（三项增量验收 + 既有核心能力回归）
- **执行者**：QA Agent
- **结果**：**PASS**（代码走查 + API 测试通过；GUI 需人工确认）
- **构建门禁**：tsc --noEmit ✅、npm run lint ✅
- **commit 验证**：未提交（Builder 已自测通过，待用户授权 commit/push）
- **已关闭**：无新增关闭
- **阻断项**：无
- **需人工确认**：GUI 视觉验证（搜索相关度排序、标签删除×按钮、normalizeBody 格式效果）

### 三项逐条验证

**P2-8 搜索结果按相关度排序**
- `relevanceScore` 函数（page.tsx:21-29）：`const t = term.toLowerCase()` 修正大小写敏感 bug ✅
- 打分权重：title=4 / code=3 / tag=3 / notes=2 / body=1，命中取最高分 ✅
- `visibleCards` 排序分支（page.tsx:195-204）：`searchActive && !searchTerm.startsWith('@')` 时先按 score desc、同分按 sortMode 二级排序 ✅
- `@code` 直达模式（page.tsx:174-177）：仅按 code 过滤，维持原 sortMode ✅
- 无搜索恢复（page.tsx:202-203）：清空搜索后按 sortMode 排序 ✅
- `compareBySortMode`（page.tsx:32-36）：抽出现有三分支逻辑，二级排序正确 ✅

**P2-9 左侧标签管理**
- `handleDeleteTag`（page.tsx:322-332）：统计含该标签卡片数 → confirm → 批量移除标签条目（不删卡）✅
- `TagRow` 重构（TagPanel.tsx:14-58）：div 容器（避免 button 嵌套），主按钮 flex-1 + 右侧 ×（hover/focus-visible 显示）✅
- `onDeleteTag` prop（TagPanel.tsx:11）：可选，demo 视图不传（page.tsx:415 `isDemoView ? undefined : handleDeleteTag`）✅
- 当前选中标签被删时取消选中（page.tsx:330 `if (selectedTag === tag) setSelectedTag(null)`）✅
- 复用现有 cards 落盘 + SSE 同步链 ✅

**P3-6 正文格式规范化**
- `normalizeBody`（cards.ts:19-35）：① 逐行去前导 tab ✅ ② 纯空白行归一 ✅ ③ 非空行前导空格保留最多 4 个 ✅ ④ 去首尾空行（slice 头尾）✅ ⑤ 合并连续空行（`\n{3,}` → `\n\n`）✅
- `saveBodyOnly`（cards.ts:66-70）：先 `normalizeBody(newBody)` 再 `===` 比较 ✅
- `saveBodyWithVersion`（cards.ts:75-79）：先 `normalizeBody(newBody)` 再 `withVersion` ✅
- `parseImport`（storage.ts:260）：JSON 路径 `.map(c => ({...c, body: normalizeBody(c.body)}))` ✅
- `parseMarkdownImport`（storage.ts:119）：`flush()` 内 `normalizeBody(current.body.join('\n'))` ✅

### GUI 测试用例（需人工执行）

**T1: 失焦不建版、手动保存才建版**
- 步骤：打开 http://localhost:3000 → 选卡 → 修改正文 → 失焦（2次）→ 观察版本数 → 点保存
- 预期：失焦版本数不增加；点保存后版本数+1
- 验证：curl /api/sync 中该卡 versions 数组长度

**T2: 500ms内连改两张卡同步一致性**
- 步骤：选卡A改标题 → 立即切卡B改标题 → 立即切回卡A再改 → 等2-3秒
- 预期：curl /api/sync 中A、B两卡标题与页面一致
- 验证：刷新页面确认UI拉取结果与本地一致

**T3: 弹窗内快捷键屏蔽**
- 步骤：双击卡片打开详情 → 点击按钮获得焦点 → 按1/3/5
- 预期：背景卡评分不变、无toast
- 验证：关闭弹窗后确认背景卡星级未变

**T4: Esc关闭详情内容保留**
- 步骤：详情弹窗修改标题 → 不失焦直接Esc → 重开详情
- 预期：标题修改已保留
- 验证：curl确认服务端已落盘

**T5: 备注切换卡片不丢失**
- 步骤：选卡A输入备注 → 700ms内切卡B → 等1秒检查
- 预期：卡A备注已保存、卡B备注为空
- 验证：curl核对A.notes正确、B.notes未变

**T6: Markdown导出导入完整还原**
- 步骤：点导出下载.md → 点导入选择.md文件 → 确认覆盖
- 预期：导入成功、卡片数与导出一致
- 验证：curl核对卡片数

**T7: 双卡同码冲突语义**
- 步骤：卡X设调取码qatest失焦 → 卡Y改标题+调取码qatest失焦
- 预期：卡Y标题已保存、调取码未落盘、有冲突提示
- 验证：静默保存时也应有冲突提示

| 编号 | 描述 | 严重度 | 状态 | 负责人 |
|---|---|---|---|---|
| BUG-4 | 跨设备同步依赖 dev 服务所在机器开机且服务存活；Mac 睡眠或服务退出后同步中断（已知限制，非缺陷） | P2 | 已知限制 | — |
| BUG-5 | WorkBuddy「调取」后是否自动按卡片角色执行，取决于模型遵循工具描述；若仍询问用户，需在 WorkBuddy 全局系统提示词加固定指令（见 HANDOFF） | P2 | 已知限制 | — |
| BUG-6 | 回滚版本时 `rollbackToVersion` 先对当前正文做版本快照再覆盖，导致每次回滚都新增一条重复版本记录、污染历史 | P1 | 已修复（2026-08-25，改动 `src/lib/cards.ts`） | — |
| BUG-7 | `npm run lint` 报错：React 19 要求 refs 只能在 effect/event handler 中赋值，不能在 render 阶段。涉及 `CardDetail.tsx:67` 和 `PreviewPanel.tsx:74` 的 `draftRef.current = draft` | P1 | 已修复（2026-08-26，`PreviewPanel.tsx` / `CardDetail.tsx`：`draftRef` 改用 `useEffect` 同步，不再渲染期赋值） | — |

> 历史 BUG-1/2/3（见 CODE_REVIEW.md）已于 2026-08-25 随「同步 + UI + MCP」改造确认修复并关闭；BUG-6 回滚污染历史于同日修复。
