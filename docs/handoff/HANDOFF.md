# 交接上下文（提示词管理工具）

> 供新会话继续工作。仅含：当前状态、关键决定、文件结构、约束、下一步。不含讨论过程。

## 当前状态

- 项目：提示词管理工具（Prompt Manager），Next.js 16（App Router）+ React 19 + TypeScript 5 + Tailwind v4。
- 阶段：功能开发期。已完成主体：跨设备实时同步、UI 优化（含正文优先布局重构）、调取码字段、MCP 集成、MCP 调用计数、备注字段、失焦自动保存、回滚 bug 修复、**全局搜索 + 健壮性批次（范围 A+B）**。
- **最新提交（bef563f，已推送）**：「全局搜索 + 健壮性批次（RISK-3/OPT-NEW-2/P3-1/P3-3）」：
  - 全局搜索（P2-2）：SortBar 旁搜索框 + 300ms 防抖 + 标题/正文/标签/调取码/备注五字段过滤（大小写不敏感）+ 与标签筛选/排序 AND 叠加 + `@code` 直达（仅按调取码匹配）+ `<mark>` 纯文本拆分高亮（XSS 免疫）+ SortBar「命中 x / 共 y」计数 + 空态引导；搜索词不持久化。
  - RISK-3 已修复：PreviewPanel / CardDetail / Composer 5 处 AI 请求全部接入 AbortController（新请求前 abort 旧、卸载 abort、`ac.signal.aborted` 守卫跳过 toast/setState）。
  - OPT-NEW-2 已修复：`useModalFocus` 抽为共享 Hook（`src/hooks/useModalFocus.ts`），CardDetail 与 SettingsModal 复用（Tab 循环 / 首焦点 / 归还 / 可选 Esc）。
  - P3-1：标题「x/20」、调取码「x/12」计数 + 调取码非法字符即时过滤并提示；P3-3：仓库空态与面板占位引导文案。
- 上一提交（44c4a3a）：P0/P1 修复 8 项（渲染期 ref / 失焦不建版 / 同步串行化 / 评分快捷键守卫 / TagPanel 文案 / 关闭切卡丢稿 / 导入选择器 / 调取码冲突语义）。
- 远程仓库：https://github.com/wanghoufan/prompt-manager.git（master，已配置）。
- dev 服务：`./dev-server.sh` watchdog 管理（start/stop/restart/status/logs），监听 `*:3000`。

## 关键决定

1. **跨设备同步**：服务端共享存储方案——`serverStore` 进程内单例 + `data/store.json` 落盘 + SSE 推送（`/api/sync`、`/api/sync/stream`）。localStorage 保留为离线兜底；首次服务端为空且有本地数据时自动迁移上传。
2. **调取码（code）**：`Card.code` 用户自定义短码（可选，`[a-z0-9-]` ≤12 字符，小写存储，大小写不敏感）。UI 保存时实时冲突校验（冲突跳过 code 字段、其余照存 + 可见提示）；输入时即时过滤非法字符；Markdown 导出/导入带 `- 调取码：` 行。
3. **MCP 集成**：子包 `mcp/prompt-server/`（`@modelcontextprotocol/sdk` + zod，stdio）。工具 `prompt_manager_activate_prompt(code)`：直接读 `data/store.json` 命中卡片，返回包装为「[系统提示词已切换]」的 text，强指令 WorkBuddy 立即按新角色继续；**命中后调 `/api/sync/increment-copy` 给 copyCount +1**（与手动复制共用总数）。
4. **MCP 注册位置（重要坑）**：WorkBuddy UI 读的是 `~/.workbuddy/mcp.json`（**不带点**）；`~/.workbuddy/.mcp.json`（**带点**）是 connector-proxy 专用，勿混。MCP 中途启用需**新开会话**才加载工具元数据。
5. **触发话术**：单纯发短码 WorkBuddy 不识别，需「调取/激活/加载/切换到/用…跑 + 短码」。
6. **自动注入限制**：MCP 协议无法强制客户端把 tool result 注入 system prompt；最终依赖 WorkBuddy 模型遵循工具 description，或用户在 WorkBuddy 全局系统提示词加固定指令。
7. **全局搜索**：`searchQuery`（受控即时值）与 `debouncedQuery`（300ms 防抖过滤依据）分离，均仅 `useState` 不持久化（刷新即清）；过滤链三段：`baseCards`（视图+标签）→ 搜索过滤（普通 5 字段 includes / `@` 模式仅 code）→ 排序；搜索激活时 SortBar 计数切换为「命中 x / 共 y」。**已知待优化**：搜索命中后仍按 sortMode 排序，无「标题命中优先」的相关度排序（已记 P2-8）。
8. **共享 Hook（OPT-NEW-2）**：`src/hooks/useModalFocus.ts` 统一模态框焦点（FOCUSABLE 选择器 / Tab 循环 / 打开聚焦首元素 / cleanup 归还 / 可选 onEscClose 经 ref 保存避免依赖抖动）；CardDetail 保留自有 window Esc 监听（不传 onEscClose），SettingsModal 传 onClose 处理 Esc。
9. 清理工具（neat-freak）只在整体完成 / 交付 / 文档明显失配时跑完整收尾。
10. 阶段性 `commit` / `push` 需用户明确授权；`.gitignore` 隔离 `scratch/`、`node_modules/`、`.next/`、`.env*`、`data/`、`.workbuddy/`、`mcp/prompt-server/{node_modules,dist}/`。

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

- **里程碑已收口（bef563f）：全局搜索（P2-2）+ 健壮性批次（RISK-3/OPT-NEW-2/P3-1/P3-3）已通过 QA PASS（2026-08-26）与产品验收 PASS（2026-08-26），待下轮按 `docs/review/PRODUCT_BACKLOG.md` P2-8~11/P3-6 择机排期。**
- 剩余风险（不阻断，建议单独排期）：RISK-1 MCP 直读 `store.json` 陈旧数据、RISK-2 MCP 计数失败静默、RISK-5 调取码冲突边缘场景，详见 `docs/review/CODE_REVIEW.md`。
- 待办候选：P2-8 搜索相关度排序（标题命中优先）、P2-9 标签管理（删除标签=批量移除，不删卡片）、P2-10 网格直删入口、P2-11 批量管理、P2-3 `<md` 面板适配、P2-5 危险操作撤销、P2-7 空/离线态区分；P3：版本 diff、Composer 自适应、P3-6 正文格式规范化等，详见 PRODUCT_BACKLOG。
- 若 WorkBuddy 调取仍不自动按角色执行，用户可在 WorkBuddy 全局系统提示词加入工具触发说明。
