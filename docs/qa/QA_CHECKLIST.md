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
