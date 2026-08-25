# 交接上下文（提示词管理工具）

> 供新会话继续工作。仅含：当前状态、关键决定、文件结构、约束、下一步。不含讨论过程。

## 当前状态

- 项目：提示词管理工具（Prompt Manager），Next.js 16（App Router）+ React 19 + TypeScript 5 + Tailwind v4。
- 阶段：功能开发期。已完成主体：跨设备实时同步、UI 优化（含正文优先布局重构）、调取码字段、MCP 集成、MCP 调用计数、回滚 bug 修复。
- **工作区有未提交改动**（正文优先布局重构 + 回滚 bug 修复 + Composer 单行化 + SortBar 排序方式标签 + 调取码 + MCP 集成 + 计数，涉及 `src/lib/cards.ts`、`src/components/*`、`src/app/page.tsx`、`mcp/`）；上一版（同步功能）已推送 `88843dd`。
- 远程仓库：https://github.com/wanghoufan/prompt-manager.git（master，已配置）。
- dev 服务：`./dev-server.sh` watchdog 管理（start/stop/restart/status/logs），监听 `*:3000`。

## 关键决定

1. **跨设备同步**：服务端共享存储方案——`serverStore` 进程内单例 + `data/store.json` 落盘 + SSE 推送（`/api/sync`、`/api/sync/stream`）。localStorage 保留为离线兜底；首次服务端为空且有本地数据时自动迁移上传。
2. **调取码（code）**：`Card.code` 用户自定义短码（可选，`[a-z0-9-]` ≤12 字符，小写存储，大小写不敏感）。UI 保存时实时冲突校验；Markdown 导出/导入带 `- 调取码：` 行。
3. **MCP 集成**：子包 `mcp/prompt-server/`（`@modelcontextprotocol/sdk` + zod，stdio）。工具 `prompt_manager_activate_prompt(code)`：直接读 `data/store.json` 命中卡片，返回包装为「[系统提示词已切换]」的 text，强指令 WorkBuddy 立即按新角色继续；**命中后调 `/api/sync/increment-copy` 给 copyCount +1**（与手动复制共用总数）。
4. **MCP 注册位置（重要坑）**：WorkBuddy UI 读的是 `~/.workbuddy/mcp.json`（**不带点**）；`~/.workbuddy/.mcp.json`（**带点**）是 connector-proxy 专用，勿混。MCP 中途启用需**新开会话**才加载工具元数据。
5. **触发话术**：单纯发短码 WorkBuddy 不识别，需「调取/激活/加载/切换到/用…跑 + 短码」。
6. **自动注入限制**：MCP 协议无法强制客户端把 tool result 注入 system prompt；最终依赖 WorkBuddy 模型遵循工具 description，或用户在 WorkBuddy 全局系统提示词加固定指令。
7. 清理工具（neat-freak）只在整体完成 / 交付 / 文档明显失配时跑完整收尾。
8. 阶段性 `commit` / `push` 需用户明确授权；`.gitignore` 隔离 `scratch/`、`node_modules/`、`.next/`、`.env*`、`data/`、`.workbuddy/`、`mcp/prompt-server/{node_modules,dist}/`。

## 文件结构（根目录，关键项）

```
├── AGENTS.md              # 项目档案 + 多 Agent 协作规则（文档唯一归属表）
├── CLAUDE.md              # @AGENTS.md 导入
├── README.md              # 使用 / 接入说明（含 MCP）
├── dev-server.sh          # dev 服务 watchdog 管理脚本
├── next.config.ts         # allowedDevOrigins（局域网来源放行）
├── src/
│   ├── app/api/           # ai/*（DeepSeek 代理）、sync/*（共享存储 + SSE + 计数）
│   ├── components/        # CardItem / PreviewPanel / CardDetail 等
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

## 下一步

- 提交并推送工作区未提交改动（UI + 调取码 + MCP + 计数）——需用户确认后执行。
- 待办候选见 `docs/review/PRODUCT_BACKLOG.md`（MCP 写操作、调取码自动建议、拖拽排序等）。
- 若 WorkBuddy 调取仍不自动按角色执行，用户可在 WorkBuddy 全局系统提示词加入工具触发说明。
