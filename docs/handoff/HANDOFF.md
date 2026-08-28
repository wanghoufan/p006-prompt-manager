# 交接上下文（提示词管理工具）

> 供新会话继续工作。仅含：当前状态、关键决定、文件结构、约束、下一步。不含讨论过程。

## 当前状态

- 项目：提示词管理工具（Prompt Manager），Next.js 16（App Router）+ React 19 + TypeScript 5 + Tailwind v4。
- 阶段：功能开发期。已完成主体：跨设备实时同步、UI 优化（含正文优先布局重构）、调取码字段、MCP 集成、MCP 调用计数、备注字段、失焦自动保存、回滚 bug 修复、**全局搜索 + 健壮性批次（范围 A+B）+ P2-8/P2-9/P3-6 三项打包 + P0-1~P0-7（含 11合1 总验收 + 2合1）+ P0 标签系统核心 22项 + Fix chip 双写 + P0-9 标签添加交互重构（flomo 风格 #标签+回车/空格，QA 第十五次/产品 2026-08-28 PASS）+ P1-1~P1-4 四项打包（文案/草稿/导入/冲突，QA 第十六次/产品 2026-08-28 PASS）+ P2-10/P2-11 网格直删+批量管理（QA/产品 2026-08-28 12项 PASS）+ P0-A 安全闭环（影响数+10s 撤销+服务端5项校验+带版本号提交，QA/产品 2026-08-28 4项 PASS）+ P0-D/P0-E/P0-F/P0-G/P0-H 用户反馈问题整改（QA 2026-08-28 5项 PASS）**。
- **最新提交（P0级用户反馈问题整改，待推送）**：「P0级用户反馈问题整改（QA 2026-08-28 5项 PASS）」：
  - P0-D 标签切换逻辑修复：单击标签切换筛选，再次单击取消筛选，功能正常。
  - P0-E 标签拖拽功能实现：拖拽功能已实现，有操作提示「拖到上/下边缘排序，拖到标签上可设为子标签或合并」。
  - P0-F 右侧预览面板排版优化：标题突出（文本栏形式），调取码收进标题行（@符号 + 调取码输入框），布局合理。
  - P0-G MCP连接说明文档：设置中新增MCP连接说明区域，包含配置示例、安装说明、使用说明。
  - P0-H MCP连接一键复制提示词：设置中 MCP 连接说明改为三场景（GPT/WorkBuddy/Orca）一键复制提示词，每场景提供构建命令 + 完整 AI 代理可执行提示词（含环境检测、路径填充、配置写入、新开会话指令）。
- 上一提交（P0-A 安全闭环）：「P0-A 高影响标签操作的安全闭环（QA/产品 2026-08-28 4项 PASS）」。
- 远程仓库：https://github.com/wanghoufan/prompt-manager.git（master，已配置）。
- dev 服务：`./dev-server.sh` watchdog 管理（start/stop/restart/status/logs），监听 `*:3000`。

## 关键决定

1. **跨设备同步**：服务端共享存储方案——`serverStore` 进程内单例 + `data/store.json` 落盘 + SSE 推送（`/api/sync`、`/api/sync/stream`）。localStorage 保留为离线兜底；首次服务端为空且有本地数据时自动迁移上传。
2. **调取码（code）**：`Card.code` 用户自定义短码（可选，`[a-z0-9-]` ≤12 字符，小写存储，大小写不敏感）。UI 保存时实时冲突校验（冲突跳过 code 字段、其余照存 + 可见提示）；输入时即时过滤非法字符；Markdown 导出/导入带 `- 调取码：` 行。
3. **MCP 集成**：子包 `mcp/prompt-server/`（`@modelcontextprotocol/sdk` + zod，stdio）。工具 `prompt_manager_activate_prompt(code)`：直接读 `data/store.json` 命中卡片，返回包装为「[系统提示词已切换]」的 text，强指令 WorkBuddy 立即按新角色继续；**命中后调 `/api/sync/increment-copy` 给 copyCount +1**（与手动复制共用总数）。
4. **MCP 注册位置（重要坑）**：WorkBuddy UI 读的是 `~/.workbuddy/mcp.json`（**不带点**）；`~/.workbuddy/.mcp.json`（**带点**）是 connector-proxy 专用，勿混。MCP 中途启用需**新开会话**才加载工具元数据。
5. **触发话术**：单纯发短码 WorkBuddy 不识别，需「调取/激活/加载/切换到/用…跑 + 短码」。
6. **自动注入限制**：MCP 协议无法强制客户端把 tool result 注入 system prompt；最终依赖 WorkBuddy 模型遵循工具 description，或用户在 WorkBuddy 全局系统提示词加固定指令。
7. **全局搜索**：`searchQuery`（受控即时值）与 `debouncedQuery`（300ms 防抖过滤依据）分离，均仅 `useState` 不持久化（刷新即清）；过滤链三段：`baseCards`（视图+标签）→ 搜索过滤（普通 5 字段 includes / `@` 模式仅 code）→ 排序；搜索激活时 SortBar 计数切换为「命中 x / 共 y」；**P2-8 已补相关度排序**：非 `@` 搜索时先按 `relevanceScore`（title 4 / code 3 / tag 3 / notes 2 / body 1，`toLowerCase()` 大小写不敏感）score desc、同分再 `compareBySortMode` 二级排序，`@code` 直达保持原 sortMode。
8. **共享 Hook（OPT-NEW-2）**：`src/hooks/useModalFocus.ts` 统一模态框焦点（FOCUSABLE 选择器 / Tab 循环 / 打开聚焦首元素 / cleanup 归还 / 可选 onEscClose 经 ref 保存避免依赖抖动）；CardDetail 保留自有 window Esc 监听（不传 onEscClose），SettingsModal 传 onClose 处理 Esc。
9. **标签管理（P2-9）**：`TagPanel` hover× 批量移除语义与 Flomo 一致（只删标签条目，不删卡片，原文不动）；`handleDeleteTag` 复用 `setCards` 落盘+SSE 同步链，计数归 0 自动消失。
10. **正文规范化（P3-6）**：`normalizeBody` 左对齐 5 步规则（去前导 tab / 纯空白归一 / 最多保留 4 空格 / 去首尾空行 / 合并连续空行），在 `saveBodyOnly`/`saveBodyWithVersion` 与导入两路径统一入口，保证新建与导入一致。
11. **P0-1 留空**：`DISCARD_TAGS`+`normalizeTags` 过滤 5 脏标签（大小写不敏感），`META_PROMPT` 约束禁止占位，`parseTags` 不过滤以免存量隐性清理。
12. **P0-2 筛选态继承**：`handleCreate` 选中标签强制首位 `Set([selectedTag,...aiTags]).slice(0,3)`，全部/demo 不强制。
13. **P0-3 去重**：`handleCreate` 入口 `normalizeBody` 全等比对 + `confirm` 二次确认，空内容不触发；Composer 取消仍 toast 小风险已记录。
14. **P0-4 网格直删**：`CardItem` `onDelete` prop + `page.tsx` 条件 `confirm` + `Settings.confirmDelete` 持久化（`storage.ts` 归一化三路径）；demo 隐藏，预览/详情共用 handler。
15. **P0-5 高亮双主题**：`globals.css` `--color-highlight*` 暗/亮两套 + `html.light` 纸墨 + `color-scheme`，`CardItem` mark 变量驱动；`layout.tsx` 内联防 FOUC + `suppressHydrationWarning`；`page.tsx` theme 实时跟随；`SettingsModal` 主题 select。
16. 清理工具（neat-freak）只在整体完成 / 交付 / 文档明显失配时跑完整收尾。
17. 阶段性 `commit` / `push` 需用户明确授权；`.gitignore` 隔离 `scratch/`、`node_modules/`、`.next/`、`.env*`、`data/`、`.workbuddy/`、`mcp/prompt-server/{node_modules,dist}/`。

## 文件结构（根目录，关键项）

```
├── AGENTS.md              # 项目档案 + 多 Agent 协作规则（文档唯一归属表）
├── CLAUDE.md              # @AGENTS.md 导入
├── README.md              # 使用 / 接入说明（含 MCP）
├── dev-server.sh          # dev 服务 watchdog 管理脚本
├── next.config.ts         # allowedDevOrigins（局域网来源放行）
├── src/
│   ├── app/api/           # ai/*（DeepSeek 代理）、sync/*（共享存储 + SSE + 计数）
│   ├── components/        # CardItem / PreviewPanel / CardDetail / SortBar 等
│   ├── hooks/             # useModalFocus（共享模态框焦点 Hook，OPT-NEW-2）
│   └── lib/               # cards / storage / serverStore / types / demo 等
├── mcp/prompt-server/     # MCP 子包（独立 node_modules/dist，已忽略）
├── docs/
│   ├── pm/                # 需求文档、产品报告、PLAN
│   ├── qa/                # BUGS、QA_CHECKLIST
│   ├── review/            # CODE_REVIEW、PRODUCT_BACKLOG
│   ├── roles/             # Agent 角色规范
│   └── handoff/HANDOFF.md # 本文件
├── data/                  # 运行时共享数据（store.json，不进仓库）
└── scratch/               # 临时资料，不进仓库
```

## 约束

- 密钥、`.env*`、`data/`（含用户提示词）、`.workbuddy/` 永不进仓库。
- 临时脚本 / 实验副本只放 `scratch/`。
- MCP server 改完必须 `cd mcp/prompt-server && npm run build`；改了工具语义需提示用户**新开会话**。
- 跨设备同步依赖 dev 服务所在机器开机且服务运行；IP 变化时更新 `allowedDevOrigins`（或用 `.local` 主机名）。
- 不删除 `AGENTS.md` 的协作约定段；文档更新遵循「唯一归属表」。
- 运行时数据（`data/store.json`）操作须先备份 + 停服（防 serverStore 内存回写覆盖），改后 `python3 -m json.tool` 校验再重启。

## 下一步

- **里程碑已收口（待推送）：P0-A 安全闭环已通过 QA（2026-08-28 4项 ALL PASS，tsc/lint 0 错误，服务端 7 项 curl 校验 + 真机撤销验证）与产品验收 PASS，P0级用户反馈问题整改（P0-D/E/F/G/H）QA 5项 ALL PASS + 产品验收 PASS，无新增 Bug/P1；待本仓库一次性提交推送；收口下一步为「剩余 P2 优化项」择机排期，无 Fix 遗留。**
- 剩余风险（不阻断）：RISK-1/2 MCP 陈旧/静默、RISK-5 调取码冲突、P0-3 Composer toast、L1 数据恢复事件（7 标签/3 关联损失，浏览器 localStorage 未被 SSE 覆盖则重连回补），详见 `CODE_REVIEW.md` 与 `CURRENT_STAGE.md`。
- 待办候选：剩余 P2 未完成项择机排期，无 Fix 遗留。
- 若 WorkBuddy 调取仍不自动按角色执行，用户可在 WorkBuddy 全局系统提示词加入工具触发说明。
