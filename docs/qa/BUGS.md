# Bug 记录（BUGS）

> 当前未关闭 / 已确认的 Bug。由 QA 记录，开发更新修复状态。`【修复】` 优先处理 P0、P1；P2 / P3 / Future 默认不自动开发。

## 最近一次 QA 执行记录

- **日期**：2026-08-27（第七次 - P0-1/P0-2/P0-3 用户反馈三项打包回归验收）
- **模式**：QA Acceptance（三项增量验收 + 既有核心能力回归）
- **执行者**：QA Agent
- **结果**：**PASS**（代码走查 + API 测试通过；GUI 需人工确认）
- **构建门禁**：tsc --noEmit ✅、npm run lint ✅
- **commit 验证**：未提交（Builder 已自测通过，待用户授权 commit/push）
- **已关闭**：无新增关闭
- **阻断项**：无
- **需人工确认**：GUI 视觉验证（P0-1 多条口语内容 AI 端到端、P0-2 多标签筛选态新建、P0-3 确认/取消分支）

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

### 三项逐条验证

**P0-1 AI 无法分类时标签留空**
- `DISCARD_TAGS`（cards.ts:90）：`new Set(['无法分类','未分类','其他','无','无标签'])` ✅
- `normalizeTags`（cards.ts:98-109）：trim → DISCARD 丢弃（大小写不敏感 `t.toLowerCase()`）→ 去空 → 去重 → 单标签截断 4 字 → 最多 3 个；空则保持 `[]` ✅
- `ai.ts:113` `generateMeta` 标签归一改走 `normalizeTags(rawTags)` ✅
- `prompts.ts:5` META_PROMPT 约束：「若无法判断则返回 []，禁止返回「无法分类」类占位标签」✅
- `parseTags` 不过滤决策（cards.ts:111-112）：保持原行为，避免存量脏标签隐性清理 ✅

**P0-2 标签筛选态下新建默认携带当前选中标签**
- `handleCreate` 签名（page.tsx:211）：`body, title, aiTags` ✅
- `selectedTag && !isDemoView && selectedTag !== ''` 时强制首位（page.tsx:227-228）：`Array.from(new Set([selectedTag, ...aiTags])).slice(0, 3)` ✅
- 「全部」下不强制（page.tsx:227 条件 false 时维持原 AI tags）✅
- demo 视图不继承（page.tsx:227 `!isDemoView`）✅

**P0-3 重复内容去重提示**
- `handleCreate` 入口（page.tsx:214-223）：`bodyNorm = normalizeBody(body.trim())`，与 `cards.find(c => normalizeBody(c.body.trim()) === bodyNorm)` 全等比对 ✅
- 命中首个 `window.confirm`（page.tsx:219）文案完全匹配「检测到内容已存在（标题「X」），是否仍要添加？」✅
- 取消 `return` 中断（page.tsx:220-222）、确认继续建卡（跳过 return）✅
- `bodyNorm` 为空不触发（page.tsx:215 `if (bodyNorm)` 短路）✅
- 多次命中仅首个（`find` 而非 `filter`）✅

**既有回归**
- P2-8 搜索相关度 / P2-9 标签删除 × / P3-6 左对齐：代码路径未改变 ✅
- 失焦保存不建版 / 手动建版：bodyDirtyRef 机制未改变 ✅
- API `/api/sync` 正常返回数据（curl 测试通过）✅

**已知小风险（不阻断）**
- Composer.onCreate 在 `onCreate` 同步返回 `false` 后仍 `setText('')` + `notify('已创建卡片')`，用户取消 confirm 后会看到「已创建卡片」toast 但实际未建卡（CURRENT_STAGE 已记录，建议未来 Composer 改 `onCreate: () => boolean` 协议）

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
