# 核心回归测试清单（QA_CHECKLIST）

> 长期核心回归基线，随真实测试持续补充高价值回归项。新项目可从空框架开始；neat-freak 在重要阶段负责修剪与更新。

## 回归项

### 基础卡片 CRUD
- [ ] 粘贴正文 → AI 生成标题 + 标签 → 建卡成功；失败时可「重试 / 直接创建」
- [ ] 卡片显示标题 + 2 行正文预览 + 标签 + `@调取码` 徽标 + 星级 + 复制次数
- [ ] 编辑正文后保存 → 旧版本自动快照到版本历史
- [ ] 版本回滚：选择历史版本 → 正文恢复为该版本；回滚**不**新增版本记录
- [ ] 版本上限：正文变化超过 10 次后，最旧版本被丢弃
- [ ] 删除卡片：确认后删除，列表刷新后不再出现

### 调取码
- [ ] 填码（英文/数字/短横线 ≤12 字符）保存成功；大写自动转小写存储
- [ ] 与其他卡片 code 冲突时红字提示，禁止保存；清空允许
- [ ] Markdown 导出含 `- 调取码：`；导入可还原；旧备份（无调取码字段）导入不报错

### 数据持久化（Persist）
- [ ] 新建/编辑卡片 → 刷新页面 → 数据仍存在（localStorage）
- [ ] 服务端运行时：数据落盘 `data/store.json` → 重启服务后数据仍存在
- [ ] localStorage 空间不足时 → 提示「保存失败」并建议导出备份
- [ ] 首次启动服务端为空 + 本机有数据 → 自动迁移上传到服务端

### 导入导出
- [ ] JSON 格式导出 → 导入恢复全部卡片和设置
- [ ] Markdown 格式导出 → 导入恢复（正文 + 标签 + 调取码 + 版本历史）
- [ ] 导入旧版本备份（无 `code`/`notes` 字段）→ 自动补全默认值，不报错
- [ ] 导入非法内容 → 提示错误，不覆盖现有数据

### 实时同步（SSE）
- [ ] dev 服务在跑时：本机 + 局域网另一台打开同一 URL 看到同一份数据
- [ ] 任一端增/删/改卡片 → 另一端几秒内自动刷新（SSE）
- [ ] 回声过滤：A 端修改 → B 端刷新 → A 端不重复刷新（版本号匹配跳过）
- [ ] 服务不可用时回退 localStorage，页面提示「未连接同步服务」
- [ ] 服务恢复后 → 数据自动从 localStorage 同步到服务端

### 右侧面板交互
- [ ] 左缘拖动手柄调宽（320–720px）；双击重置；刷新后宽度保持（localStorage）
- [ ] 思维总结 / 版本历史默认折叠，点 ▸ 展开收起
- [ ] 调取码冲突红框在面板与弹窗均生效

### 评分与计数
- [ ] 键盘 1~5 打星、0 清除；输入框/弹窗聚焦时不误触发
- [ ] 复制成功才计数 +1；复制失败提示且不计数
- [ ] 「清零」按钮将 `copyCount` 重置为 0

### MCP（子包）
- [ ] `cd mcp/prompt-server && npm run build` 无错误
- [ ] stdio 协议：initialize → tools/list 返回 `prompt_manager_activate_prompt` → call 命中返回「[系统提示词已切换]」包装 → call 未命中 isError
- [ ] MCP 调取命中后 `copyCount +1`（`POST /api/sync/increment-copy`）；未命中 404 不误加
- [ ] MCP 计数失败时 → 静默忽略，不影响卡片读取
- [ ] WorkBuddy 新会话中「调取 <code>」能触发工具并按角色继续

### 构建门禁
- [x] `npx tsc --noEmit` 零错误（2026-08-26 第三次验证通过）
- [x] `npm run lint` 零错误（2026-08-26 第三次验证通过，BUG-7 已修复）

### 备注字段（notes）
- [ ] 备注 textarea 显示在正文上方，可拖动调整高度
- [ ] 备注编辑后失焦或停手 700ms 防抖自动保存
- [ ] Markdown 导出含 `### 备注` 段；导入可还原
- [ ] 只读态紧凑展示备注内容

### 自动保存（失焦即存）
- [ ] 标题/标签/调取码/备注/星级失焦即落地
- [ ] 备注边输入边存（700ms 防抖）
- [ ] 正文失焦**不**生成版本（仅保存）；手动保存 / Ctrl(⌘)+Enter 才生成版本
- [ ] 保存后底部「已自动保存」角标
- [ ] 手动保存按钮给「已保存」提示

### P0/P1 修复验证（2026-08-26）
- [x] 渲染期 ref 赋值修复（PreviewPanel / CardDetail：`draftRef` 改用 `useEffect` 同步）
- [x] 正文失焦不再生成版本快照（拆 `saveBodyOnly` / `saveBodyWithVersion`）
- [x] 同步推送串行化（`storage.ts` schedulePush 队列化，`pushInFlight` + `pushPending`）
- [x] 全局评分快捷键守卫（`detailId` / `showSettings` 开启时禁用）
- [x] TagPanel 文案与离线态提示（"局域网实时同步…离线回退"）
- [x] 关闭/切卡丢稿 + 备注定时器泄漏修复（卸载 flush + clearTimeout）
- [x] 导入选择器支持 `.md`（`accept=".json,.md"`）
- [x] 调取码冲突语义统一（跳过冲突字段、其余照存、冲突提示）

### P1 打包验证 - 2026-08-28 验证（第十六次）

- [x] P1-1 TagPanel 底部文案：`TagPanel.tsx:530-534`，online 态「已开启局域网实时同步…离线回退本机缓存」，offline 态「未连接同步服务，已使用本机本地数据」，`offline` prop 区分
- [x] P1-2 关闭/切卡丢稿修复：CardDetail handleClose 先 commitSave(true) 再关闭；PreviewPanel [card] useEffect 切换前 flush + cleanup 兜底 flush + clearTimeout notesTimer
- [x] P1-3 导入选择器 .md：`TopBar.tsx:70` accept=".json,.md,application/json,text/markdown"，title 明确"支持 JSON 与 Markdown"
- [x] P1-4 冲突语义统一：CardDetail + PreviewPanel saveThrough 逻辑完全对齐（跳过 code、其余照存、同一 toast 文案），allCodes 统一来源 page.tsx:253-256
- [x] 构建门禁：tsc --noEmit ✅ 0 错误、npm run lint ✅ 0 错误

### 全局搜索（P2-2）- 2026-08-26 验证
- [x] SortBar 搜索框：放大镜 + 清除按钮 + placeholder「搜索标题/正文/标签/备注 · @code 直达」
- [x] 过滤链三段：baseCards → 搜索过滤 → 排序，AND 叠加
- [x] @code 直达：`@` 开头仅按 code includes（lowercase），不匹配正文
- [x] 多字段过滤：标题/正文/标签/调取码/备注，大小写不敏感
- [x] 高亮：`highlightParts` 纯文本拆分 + `<mark className="rounded-[2px] bg-gold/30">`，XSS 免疫
- [x] 计数：`search.trim()` 非空时「命中 x / 共 y」
- [x] 空态：0 命中时「未找到匹配的卡片」+ 引导
- [x] 不持久化：`searchQuery` 仅 useState，刷新即清

### 健壮性批次 - 2026-08-26 验证
- [x] RISK-3 AbortController：PreviewPanel（metaAbortRef/summaryAbortRef）、CardDetail（metaAbortRef/summaryAbortRef）、Composer（abortRef）共 5 处 AI 请求
- [x] 新请求前 abort 旧请求：`abortRef.current?.abort()` + `const ac = new AbortController()`
- [x] 卸载 cleanup abort：`useEffect(() => () => { abortRef.current?.abort() }, [])`
- [x] ac.signal.aborted 守卫：catch/finally 中跳过 toast/setState
- [x] OPT-NEW-2 useModalFocus：FOCUSABLE 选择器 / Tab 循环 / 首焦点 / 归还 / onEscClose ref
- [x] CardDetail 复用 useModalFocus（无 onEscClose，保留自有 window Esc 监听）
- [x] SettingsModal 复用 useModalFocus（传 onClose 处理 Esc）
- [x] P3-1 标题计数 x/20、调取码计数 x/12
- [x] P3-1 调取码非法字符即时过滤 `replace(/[^a-zA-Z0-9-]/g,'')` + 2.5s 提示
- [x] P3-3 仓库空态引导文案「双击卡片进入详情 · 拖动左缘调宽，双击重置 · 选中后 1-5 打星」
- [x] P3-3 PreviewPanel !card 占位引导文案

### 既有能力回归 - 2026-08-26 验证
- [x] 失焦保存不建版（代码走查确认 bodyDirtyRef 机制）
- [x] 手动/Ctrl+Enter 才建版（代码走查确认）
- [x] 评分快捷键在 detailId/showSettings 时屏蔽（代码走查 page.tsx:338）
- [x] API /api/sync 正常返回数据（curl 测试通过）

### P2-8/P2-9/P3-6 - 2026-08-26 验证
- [x] P2-8 relevanceScore：title=4 / code=3 / tag=3 / notes=2 / body=1，`const t = term.toLowerCase()` 大小写不敏感
- [x] P2-8 visibleCards：`searchActive && !searchTerm.startsWith('@')` 时先按 score desc、同分按 sortMode 二级排序
- [x] P2-8 @code 直达：`@` 开头仅按 code includes，维持原 sortMode（跳过相关度排序）
- [x] P2-8 无搜索恢复：清空搜索后按 sortMode 排序
- [x] P2-8 compareBySortMode：抽出现有三分支逻辑（updated/copies/rating），二级排序正确
- [x] P2-9 handleDeleteTag：统计含该标签卡片数 → confirm → 批量移除标签条目（不删卡）
- [x] P2-9 TagRow 重构：div 容器（避免 button 嵌套），主按钮 flex-1 + 右侧 ×（hover/focus-visible 显示）
- [x] P2-9 onDeleteTag prop：可选，demo 视图不传（isDemoView ? undefined : handleDeleteTag）
- [x] P2-9 当前选中标签被删时取消选中（if (selectedTag === tag) setSelectedTag(null)）
- [x] P3-6 normalizeBody：① 逐行去前导 tab ② 纯空白行归一 ③ 非空行前导空格保留最多 4 个 ④ 去首尾空行 ⑤ 合并连续空行
- [x] P3-6 saveBodyOnly：先 normalizeBody(newBody) 再 === 比较
- [x] P3-6 saveBodyWithVersion：先 normalizeBody(newBody) 再 withVersion
- [x] P3-6 parseImport（JSON）：`.map(c => ({...c, body: normalizeBody(c.body)}))`
- [x] P3-6 parseMarkdownImport（Markdown）：`flush()` 内 `normalizeBody(current.body.join('\n'))`
- [x] 既有回归：失焦保存不建版 / 手动建版 / 评分守卫 / API 正常

### P0-1/P0-2/P0-3 - 2026-08-27 验证
- [x] P0-1 DISCARD_TAGS：`new Set(['无法分类','未分类','其他','无','无标签'])` 5 个脏标签
- [x] P0-1 normalizeTags：trim → DISCARD 丢弃（toLowerCase 大小写不敏感）→ 去空 → 去重 → 单标签截断 4 字 → 最多 3 个；空则保持 []
- [x] P0-1 ai.ts generateMeta：标签归一改走 `normalizeTags(rawTags)`
- [x] P0-1 prompts.ts META_PROMPT：约束「若无法判断则返回 []，禁止返回「无法分类」类占位标签」
- [x] P0-1 parseTags 不过滤：保持原行为，避免存量脏标签隐性清理
- [x] P0-2 handleCreate 签名：`body, title, aiTags`
- [x] P0-2 强制首位：`selectedTag && !isDemoView && selectedTag !== ''` 时 `Array.from(new Set([selectedTag, ...aiTags])).slice(0, 3)`
- [x] P0-2 「全部」下不强制：条件 false 时维持原 AI tags
- [x] P0-2 demo 视图不继承：`!isDemoView`
- [x] P0-3 去重：`normalizeBody(body.trim())` 与 `cards.find(c => normalizeBody(c.body.trim()) === bodyNorm)` 全等比对
- [x] P0-3 confirm 文案：「检测到内容已存在（标题「X」），是否仍要添加？」
- [x] P0-3 取消 return 中断 / 确认继续建卡
- [x] P0-3 空内容不触发（`if (bodyNorm)` 短路）
- [x] P0-3 多次命中仅首个（find 而非 filter）
- [x] 既有回归：P2-8 搜索相关度 / P2-9 标签删除 / P3-6 左对齐 / 失焦保存 / 建版 / API

### P0-4/P0-5 - 2026-08-27 验证
- [x] P0-4 Settings.confirmDelete：`types.ts:27` boolean 类型，`DEFAULT_SETTINGS = true`（`storage.ts:66`）
- [x] P0-4 normalizeSettings：`storage.ts:70-78`，`typeof s.confirmDelete === 'boolean' ? s.confirmDelete : true`，非布尔补 true
- [x] P0-4 CardItem onDelete：`CardItem.tsx:18` optional prop，`!readonly && onDelete` 时渲染删除按钮（line 86-98），`stopPropagation` 调 `onDelete(card.id)`
- [x] P0-4 handleDeleteCard：`page.tsx:352-360`，`if (settings.confirmDelete && !window.confirm(...)) return` 三分支逻辑
- [x] P0-4 CardItem 传 onDelete：`page.tsx:524, 547`，`isDemoView ? undefined : handleDeleteCard`，demo 视图不传
- [x] P0-4 SettingsModal Switch：`SettingsModal.tsx:53-77`，`role="switch"` + `aria-checked`，`onClick` 即存
- [x] P0-4 handleSave 合并：`SettingsModal.tsx:29`，`onSave({ ...settings, thinkingSummaryPrompt: trimmed })` 不覆盖 confirmDelete/theme
- [x] P0-5 highlight CSS 变量：`globals.css:17-20`，暗色 `rgba(251,191,36,.42)` / `#fef3c7` / `rgba(251,191,36,.32)`，WCAG AA
- [x] P0-5 html.light 覆盖：`globals.css:29-48`，暖纸墨全套变量（ink-950→#f4f1ea / paper→#23272f / gold→#a8782e / highlight→#fde68a）
- [x] P0-5 color-scheme：`globals.css:54-56`，`html.light { color-scheme: light }`
- [x] P0-5 mark 走变量：`CardItem.tsx:34`，`bg-highlight text-highlight ring-1 ring-highlight-ring`，双主题自动适配
- [x] P0-5 防 FOUC：`layout.tsx:15-19`，`dangerouslySetInnerHTML` 内联脚本读 localStorage → matchMedia → classList.toggle
- [x] P0-5 suppressHydrationWarning：`layout.tsx:11`，抑制内联脚本与 SSR class 不一致警告
- [x] P0-5 主题 useEffect：`page.tsx:77-89`，apply 幂等切换 + system 时 matchMedia addEventListener/change + cleanup removeEventListener
- [x] P0-5 初始 state：`page.tsx:40-44`，与 DEFAULT_SETTINGS 一致 `{ confirmDelete: true, theme: 'system' }`
- [x] P0-5 主题 select：`SettingsModal.tsx:78-94`，`<select>` 三选项，onChange 即存
- [x] P0-5 normalizeSettings theme：`storage.ts:72`，三值校验，其余回退 'system'
- [x] 既有回归：P2-8 搜索相关度 / P2-9 标签删除 / P3-6 左对齐 / 失焦保存 / 建版 / API

### 工位A 验证 - 2026-08-27（P0-6/P2-6/P2-7/P3-4/P3-5 五合一）
- [x] P0-6 暗色高亮变量：`--color-highlight:#fbbf24` / `--color-highlight-text:#111111` / `--color-highlight-ring:rgba(252,211,153,.6)` / `--color-highlight-shadow:rgba(251,191,36,.25)`（globals.css:18-21）
- [x] P0-6 亮色高亮变量：`--color-highlight:#fcd34d` / `--color-highlight-text:#451a03` / `--color-highlight-ring:rgba(217,119,6,.5)` / `--color-highlight-shadow:transparent`（globals.css:45-48）
- [x] P0-6 mark 样式：`rounded-[3px] px-[1px] bg-highlight text-highlight ring-1 ring-highlight-ring shadow-[0_0_0_2px_var(--color-highlight-shadow)]`（CardItem.tsx:34）
- [x] P0-6 WCAG AA 对比度：暗色 11.31:1 / 亮色 10.39:1（均 ≥4.5:1）
- [x] P2-6 评分守卫：`if (detailId || showSettings) return` 在 keydown 首行（page.tsx:441-442），弹窗聚焦按数字不误触背景卡
- [x] P2-7 serverOnline 状态机：null=连接中 / false=离线 / true=在线（page.tsx:58）
- [x] P2-7 离线横幅：rust 横幅 + 「同步服务离线」+ 提示文案 + 重试连接按钮（page.tsx:525-534）
- [x] P2-7 连接中横幅：「正在连接同步服务…」（page.tsx:536-540）
- [x] P2-7 在线横幅：「已连接同步服务」（page.tsx:541-543）
- [x] P3-4 autoResize：useEffect([text]) 按 scrollHeight 自适应，maxRows=6，resize-none（Composer.tsx:24-37,93）
- [x] P3-5 SkippedCard 类型 + describeCardFailure 字段级原因（storage.ts:43-60,120-124）
- [x] P3-5 parseMarkdownImport 空正文入 skipped（storage.ts:151-153）
- [x] P3-5 parseImport JSON 部分导入（storage.ts:290-310）
- [x] P3-5 handleImportFile skipped → notify detail（page.tsx:423-431）
- [x] P3-5 Toast detail 可滚动列表 + 6s 展示（Toast.tsx:3,13-21,page.tsx:70-75）
- [x] 既有回归：tsc 0 错误（mcp/layout 环境前置问题）/ lint 0 错误 / curl /api/sync 31 张

### 总验收 11合1 - 2026-08-27 验证
- [x] P0-6 暗色高亮：`--color-highlight:#fbbf24` / `--color-highlight-text:#111111`（WCAG AA 11.31:1）（globals.css:17-21）
- [x] P0-6 亮色高亮：`--color-highlight:#fcd34d` / `--color-highlight-text:#451a03`（WCAG AA 10.39:1）（globals.css:44-48）
- [x] P0-6 mark 样式：`rounded-[3px] px-[1px] bg-highlight text-highlight ring-1 ring-highlight-ring shadow-[0_0_0_2px_var(--color-highlight-shadow)]`（CardItem.tsx:34）
- [x] P2-6 评分守卫：`if (detailId || showSettings) return`（page.tsx:577），useEffect deps 含 detailId/showSettings（page.tsx:597）
- [x] P2-7 离线横幅：`serverOnline === false` → rust 横幅 + 重试按钮（page.tsx:687-696）
- [x] P2-7 连接中/在线横幅：null → 「正在连接…」/ true → 「已连接」（page.tsx:698-704）
- [x] P3-4 Composer autoResize：useEffect([text]) 按 scrollHeight 自适应，maxRows=6，resize-none（Composer.tsx:27-37,93）
- [x] P3-5 导入详情：skipped → Toast detail 列表 + 6s 展示（page.tsx:550-566, Toast.tsx:35-43）
- [x] P2-1 版本节流：saveBodyOnly 全等比较失焦不建版 / saveBodyWithVersion 手动保存才建版（cards.ts）
- [x] P2-5 撤销 10s：notifyWithUndo + undoRef + 10s 定时器 + 5 处快照点（page.tsx:69-91,298,316,398,445,541）
- [x] P2-11 批量多选：bulkIds Set + toggleBulk + CardItem checkbox（role="checkbox" aria-checked）+ 操作栏（打标签/打星/导出/删除/取消）（page.tsx:61,422-528,644-669, CardItem.tsx:20-22,80-93）
- [x] P2-3 移动端抽屉：PreviewPanel `fixed inset-x-0 bottom-0 z-30 max-h-[75dvh]` 底部抽屉 + `md:relative md:w-[var(--pw)]` 桌面侧边栏 + onClose 收起按钮（PreviewPanel.tsx:314-330）
- [x] P2-4 备注防丢：useEffect cleanup clearTimeout + commitSave flush（PreviewPanel.tsx:216-225）+ 外部数据覆盖前清理（PreviewPanel.tsx:155-158）+ CardDetail 同模式（CardDetail.tsx:76,145-146,156,166）
- [x] P3-2 版本 diff：VersionDiff 组件 + lineDiff LCS 行级 diff + PreviewPanel/CardDetail 版本展开（VersionDiff.tsx, diff.ts, PreviewPanel.tsx:419-433, CardDetail.tsx:516-539）
- [x] 既有回归：tsc 0 错误 / eslint src/ 0 错误 / curl /api/sync 正常 / P0-4/5 P2-8/9 P3-6 已 CLOSED

### P0-6/P0-7 - 2026-08-28 验证
- [x] P0-6 mark 根因修复：`color: var(--color-highlight-text)`（globals.css:105），此前 `text-highlight` → `--color-highlight` 同色遮挡，现固定取 highlight-text（黑/深棕）
- [x] P0-6 暗色变量：`--color-highlight:#fbbf24` / `--color-highlight-text:#111111` / `--color-highlight-ring:rgba(252,211,77,.6)` / `--color-highlight-shadow:rgba(251,191,36,.25)`（globals.css:18-21）
- [x] P0-6 亮色变量：`--color-highlight:#fcd34d` / `--color-highlight-text:#451a03` / `--color-highlight-ring:rgba(217,119,6,.5)` / `--color-highlight-shadow:transparent`（globals.css:45-48）
- [x] P0-6 亮色半透明：`html.light mark { background: color-mix(in srgb, var(--color-highlight) 50%, transparent) }`（globals.css:111-113）
- [x] P0-6 WCAG AA：暗色 11.3:1 / 亮色 12.5:1（均 ≥4.5:1）
- [x] P0-7 悬浮胶囊：`absolute right-2 top-2 z-10` + `bg-ink-900/80 backdrop-blur-sm` + `border-line/70` + `shadow-lg`（CardItem.tsx:77-126）
- [x] P0-7 胶囊显隐：`bulkActive ? opacity-100 : opacity-0 group-hover/focus-within:opacity-100`（CardItem.tsx:80）
- [x] P0-7 正文行数：`line-clamp-3`（原 line-clamp-2 → 3 行）（CardItem.tsx:129）
- [x] P0-7 标题 pr-16：预留胶囊位，code 徽标不被盖（CardItem.tsx:58）
- [x] P0-7 胶囊内容：checkbox + 编辑 + 删除，readonly 不渲染（CardItem.tsx:77-126）
- [x] 既有回归：tsc 0 错误 / eslint src/ 0 错误 / 11合1 已 CLOSED

### P0 标签系统 22 项 - 2026-08-28 验证
- [x] 1. 创建标签：handleCreateTag 管理区（page.tsx:502-514）+ resolveTagIds 隐式创建（page.tsx:317-335）+ TagPanel「+」/菜单入口
- [x] 2. Prompt 多标签：Card.tags string[] + setCardTags 原子替换 + resolveTagIds 多名称；上限 3 保持
- [x] 3. 标签树：TreeNode 递归渲染 + expand/collapse + localStorage pm:tag-expanded 记忆 + selected 高亮 + searchTerm name/path 搜索
- [x] 4. 数量：directCount 直接 + totalCount 含子（TagPanel.tsx:155-157）；direct !== total 时显示「直接 X · 含子 Y」
- [x] 5. 父含子筛选：collectDescendantIds 递归 + collectTagPromptIds 去重 Set（page.tsx:266-268）
- [x] 6. chip × 移除 + datalist 补全：CardDetail/PreviewPanel chip 移除 + datalist existingTags 补全
- [x] 7. 重命名：handleRenameTag 重名检测 + renameTag 仅改 Tag.name + syncCardsToPromptTags 冗余同步 + tagPath 子路径自动变
- [x] 8. 移动防循环：assertNoCycle 三重检测（自/子/环）+ isNameUnique 同父重名 + moveTag 仅改 parent_id
- [x] 9. 删除两种模式：self（子标签提升一级）/ subtree（删除整棵子树）+ 双重 confirm + 绝不删 Prompt（deleteTag 级联删关系）
- [x] 10. 无标签：UNTAGGED 虚拟 id + untaggedCount + baseCards filter + TagPanel 底部入口
- [x] 11. 当前标签下新建继承：selectedTag → selName 强制首位（page.tsx:360-362）；全部/demo 不继承
- [x] 12. 外键安全：deleteTag 级联删 promptTags（tags.ts:229）+ 卡片总数不变
- [x] 13. 事务原子：applyTags setTags+setPromptTags+syncCardsToPromptTags 一次性替换
- [x] 14. isTag/isPromptTag 守卫：tags.ts:14-33 字段级校验
- [x] 15. buildTagTree：parent_id 分组 + 递归 walk + sort_order/locale 排序 + 环引用孤儿兜底
- [x] 16. deriveTagsFromCards：demo/未迁移兜底，从 Card.tags 派生临时 tags+promptTags
- [x] 17. tagPath：parent_id 链向上收集 → join(' / ')
- [x] 18. syncCardsToPromptTags：promptTags 为真源重建 Card.tags，仅变化时生成新对象
- [x] 19. normalizeTag：老数据缺 icon/is_pinned/sort_order 补默认值
- [x] 20. 迁移脚本：dry-run + --apply + .bak 备份 + validate；脏数据合并 11/55/0 孤儿
- [x] 21. API 透传：api/sync route.ts tags+promptTags 透传；curl cards=32 tags=11 promptTags=55
- [x] 22. serverStore 守卫：setState 落盘前 isTag/isPromptTag 过滤 + 完整性校验
- [x] 既有回归：tsc 0 错误 / eslint src/ 0 错误 / API cards=32 tags=11 promptTags=55 / P0-6/7 已 CLOSED

### 真机 GUI 复测 - 2026-08-28（Orca Computer Use）

- [x] 1. 重命名标签：「开发恢复」→「开发恢复2」，面板/chip/输入框/API 同步 ✅
- [x] 2. 删除标签（1 关联）：弹窗显示正确数量，确定后标签消失，卡片保留 ✅
- [x] 3a. 移动标签：「代码检查」移至「编程」下，层级结构正确，API 持久化 ✅
- [x] 3b. 环路检测：「编程」→「代码检查」被拒绝，Toast 提示正确 ✅
- [x] 4. 同级重名拒绝：重命名到已存在名称被拒绝 ✅
- [x] 5. Card chip × 移除标签：BUG-NEW-1 已修复，card.tags 与 promptTags 双写一致 ✅

### Fix QA 验证 - 2026-08-28（第十四次）

- [x] 1. chip × 移除同步：BUG-NEW-1 已修复，card.tags 与 promptTags 双写一致 ✅
- [x] 2. 重命名回滚：handleRenameTag 调用 syncCardsToPromptTags，card.tags 与 promptTags 双写一致 ✅
- [x] 3. 新建标签父校验：page.tsx:508-509 已修复，返回「父标签不存在」（非环检测） ✅
- [x] 构建门禁：tsc --noEmit ✅、npm run lint ✅

### P0-9 标签添加交互重构 - 2026-08-27 验证（第十五次）

- [x] 1. `#标签名` + 回车 → 自动添加为 chip（不依赖逗号分隔） ✅
- [x] 2. 输入时弹出已有标签下拉补全，点选即添加 ✅
- [x] 3. 每次只添加一个标签，多标签独立（chip 列表独立维护） ✅
- [x] 4. chip 可点击 × 移除单个标签 ✅
- [x] 5. 标题"添加标签"样式：居中 + `font-serif font-semibold text-paper`，与其他 label（`text-xs text-muted`）明显区分 ✅
- [x] 6. 与 `handleUpdateMeta` 的 `tagsText` 编辑链路兼容（`parseTags` `[,，、\s]+` 与 `join('、')` 双向兼容） ✅
- [x] CardDetail 路径：onChange 同时 `setDraft(tagsText)` + `onUpdateMeta(id, title, nextTags)`，与 `commitSave` 路径一致 ✅
- [x] PreviewPanel 路径：同款 onChange 双轨写入；空格键添加验证通过 ✅
- [x] atMax 行为：3 chip 时显示"已达上限"红色提示 + 下拉不渲染 ✅
- [x] 失焦自动保存：右下角"已自动保存"角标持续显示，未出现丢稿 ✅
- [x] 关闭重开持久化：3 chip 全部保留，tagsText 链路完整 ✅
- [x] 侧边栏全局标签计数实时同步（sop 3→2、qa基线 7→8、qa验收 0→1、+新标签 1），证明 onUpdateMeta + SSE 链路正常 ✅
- [x] 下拉键盘导航：Enter / Space / ArrowUp / ArrowDown / Escape 全部实现 ✅
- [x] 下拉 mousedown preventDefault：避免点击建议项时 input blur 抢先提交 ✅
- [x] 构建门禁：tsc --noEmit ✅ 0 错误、npm run lint ✅ 0 错误（2026-08-27 第四次验证通过） ✅

#### 观察项（不阻断，建议 P2/Future 评估）

- 输入法兼容性：中文拼音确认候选词按空格时，部分浏览器/输入法可能误触 `addTag`，建议未来加 `if (e.nativeEvent.isComposing) return` 守卫
- "添加标签"标题当前 `text-sm`（14px），如希望更夸张可升 `text-base`（16px），依赖用户偏好确认

### P2-10/P2-11 网格直删入口 + 批量管理 - 2026-08-28 验证

- [x] P2-10 网格直删入口：CardItem 删除按钮在 hover 时可见（text-rust 样式），点击弹出确认对话框「确定删除「{title}」？此操作不可撤销。」
- [x] P2-10 删除确认后：卡片被移除，总数正确减少，notify 提示「卡片已删除」
- [x] P2-10 demo 视图不显示删除按钮：isDemoView 时 onDelete prop 不传递
- [x] P2-11 批量多选：卡片 hover 时出现 checkbox（role="checkbox" aria-checked），点击可选中/取消
- [x] P2-11 批量操作栏：选中卡片后顶部显示「已选 N 张」+ 打标签/打星/导出/删除/取消选择按钮
- [x] P2-11 批量删除：点击删除按钮弹出确认对话框「确定删除选中的 N 张卡片？此操作不可撤销。」
- [x] P2-11 批量删除确认后：卡片被移除，总数正确减少，notifyWithUndo 提示「已删除 N 张卡片」+ 撤销按钮
- [x] P2-11 批量删除撤销：10s 内点击撤销可恢复被删除的卡片
- [x] P2-11 批量打标签：prompt 输入标签名 → 解析 → 追加去重 ≤3 → 更新卡片
- [x] P2-11 批量打星：prompt 输入 0-5 整数 → 校验 → 批量设置评分
- [x] P2-11 批量导出：筛选选中卡片 → 生成 Markdown 备份 → 下载文件
- [x] P2-11 取消选择：点击「取消选择」按钮清空 bulkIds Set，批量操作栏消失

### P0-A 安全闭环 - 2026-08-28 验证

- [x] P0-A 影响数展示：TagPanel.tsx:386 totalCount(promptTags, [tagId + ...descendants]) → confirm 显示「当前有 N 条提示词使用此标签（或其子标签）」
- [x] P0-A 子标签名列出：TagPanel.tsx:402 childrenOf().map(c=>c.name).join('、') 列出子标签名
- [x] P0-A 两种删除模式 confirm：hasKids 时二次 confirm「删除整棵子树 / 仅删自身（子标签提升）」
- [x] P0-A 10s 撤销：captureTagSnapshot + restoreTagSnapshot（page.tsx:357-365）；notifyWithUndo + withUndo:10000ms 定时（page.tsx:85-107）
- [x] P0-A 四项标签 CRUD 全部有撤销：create(565-568) rename(583-587) move(602-604) delete(613-617)
- [x] P0-A 服务端校验：validateTagGraph(tags.ts:187-226) ①同父无重名 ②id唯一 ③父级存在 ④无环 ⑤关联不悬空 ⑥(prompt_id,tag_id)唯一
- [x] P0-A 校验拦截：serverStore.ts:77-79 setState 落盘前调用 validateTagGraph，失败返回 { ok:false, error }
- [x] P0-A 客户端自愈：sanitizePromptTags(storage.ts:462-477) 推送前剔除悬空/重复关联
- [x] P0-A 版本号提交：pushToServer 发送 baseVersion:knownVersion（storage.ts:531）
- [x] P0-A 版本冲突拒绝：serverStore.ts:99-104 baseVersion !== s.version → reject + conflict:true
- [x] P0-A 冲突刷新重试：doPush 冲突时 loadFromServer → onConflictRefresh → page 重载三集合 + notify（storage.ts:426-433, page.tsx:214-223）
- [x] P0-A SSE 回声过滤：lastPushedVersion 匹配跳过（storage.ts:576）
- [x] 构建门禁：tsc --noEmit ✅ 0 错误、npm run lint ✅ 0 错误（2026-08-28 验证）

### P0级用户反馈问题整改 - 2026-08-28 真机验证

- [x] P0-D 标签切换逻辑修复：单击标签切换筛选，再次单击取消筛选，功能正常 ✅
- [x] P0-E 标签拖拽功能实现：拖拽功能已实现，有操作提示「拖到上/下边缘排序，拖到标签上可设为子标签或合并」✅
- [x] P0-F 右侧预览面板排版优化：标题突出（文本栏形式），调取码收进标题行（@符号 + 调取码输入框），布局合理 ✅
- [x] P0-G MCP连接说明文档：设置中新增MCP连接说明区域，包含配置示例、安装说明、使用说明 ✅
- [x] 真机验证：Orca Computer Use 操作 localhost:3000，截图存 scratch/qa-real-device/ ✅
- [x] 构建门禁：tsc --noEmit ✅ 0 错误、npm run lint ✅ 0 错误（2026-08-28 验证）

### P0-H MCP 连接一键复制提示词 - 2026-08-28 真机验证

- [x] SettingsModal MCP 说明拆分为 GPT / WorkBuddy / Orca 三个独立场景
- [x] 三个场景均展示独立「复制命令」按钮，构建命令包含 `npm install && npm run build`
- [x] 三个场景均展示独立「复制完整提示词」按钮，提示词包含对应客户端配置步骤和 `prompt_manager_activate_prompt`
- [x] 真机逐一点击 6 个复制按钮：剪贴板内容可读且与目标按钮匹配；按钮反馈「已复制」
- [x] MCP 子包 `cd mcp/prompt-server && npm run build` 通过
- [x] 真机截图：`scratch/qa-real-device/p0-h-settings-mcp-expanded.png`

### 3 个 P0 用户反馈问题 - 2026-08-28 复测记录

- [ ] 排序栏「有调取码」显示、仅显示有调取码卡片，并与标签筛选/搜索叠加（静态代码证据通过，Orca 真机阻断）
- [ ] TagEditor 中文输入法 compositionstart/compositionend 不自动添加英文候选词（静态代码证据通过，Orca 真机阻断）
- [ ] TagPanel 删除确认弹窗靠近删除菜单，子标签可选仅删当前/删除整棵子树（静态代码证据通过，Orca 真机阻断）
- [x] 构建门禁：`npx tsc --noEmit` ✅、`npm run lint` ✅
- **阻断**：Orca 状态 `stale_bootstrap` / `runtime_unavailable`，需恢复桌面运行时后重测并补 `scratch/qa-real-device/*.png`。
