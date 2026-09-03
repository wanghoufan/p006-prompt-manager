<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md ｜ 提示词管理工具

> 多 Agent 协作总入口：公共规则 + 文档路由 + 角色索引。
> 各 Agent 动手前先读本文件，按归属目录读写，避免产物散落或重复生成。
> 协作方法论基线参考 `AI编程项目模板-手动协同-v2.1`。

## 一、项目档案

- 项目名称：提示词管理工具（Prompt Manager）
- 项目类型：Next.js 应用 + 共享 Supabase 云端存储 + Docker 自托管 + MCP 子包
- 当前阶段：Supabase 云端多端同步已完成并获 APPROVED_FOR_EXECUTION（2026-09-03 15:00 裁定放行），Migration 5/5 已发布；legacy 退场草稿待审批；Mini 单设备安全运行期
- 主要目标：管理、编辑与测试提示词
- 主要用户：使用 GPT 等大模型、需要集中管理 Prompt 的个人 / 团队

### 技术栈

- 前端：Next.js 16（App Router）+ React 19 + TypeScript 5
- 服务端：Next.js Route Handler（AI 代理、`/api/mcp-access-tokens` MCP 令牌服务端生成）
- 共享存储：Supabase `prompt_manager` Schema（Postgres + RLS + Realtime，记录级 `revision` 条件更新，`owner_user_id` 归属）为主；`/api/sync` + `data/store.json` + localStorage 为未登录/离线兼容兜底（已获 APPROVED_FOR_EXECUTION，限期退场草稿已提交待审批，批准前保留）
- 实时同步：Supabase Realtime（cards/card_versions/tags/prompt_tags/settings 5 表，`wss://…/realtime/v1/websocket`）；旧 SSE 链路仅作兼容保留
- 认证：Supabase Auth（Magic Link + Google OAuth PKCE），`http://192.168.31.60:3100` 为已核验访问地址（`localhost`/`.local` 不在白名单/被代理劫持）
- MCP：`mcp/prompt-server/`（`@modelcontextprotocol/sdk` + zod，stdio，v0.2.0 直连 Supabase RPC），工具 `prompt_manager_activate_prompt`（`prompt_manager.activate_prompt` RPC，能力令牌 SHA-256 哈希，`SECURITY DEFINER` 已裁定接受，2 WARN 存档）
- 部署：Docker 自托管（`prompt-manager-prompt-manager-1` 绑定 `0.0.0.0:3100`，`DockerData/prompt-manager/legacy-store` bind mount，`DockerBackups/prompt-manager/` 备份不进 Git）
- AI 调用：通用 `AI_PROVIDER/AI_MODEL/AI_BASE_URL/AI_API_KEY`（支持 opencode-go 等 8 厂商），`docker/env.template` 为模板，`Services/prompt-manager/.env.local`（600 权限）不提交
- 样式方案：Tailwind CSS v4
- 代码检查：ESLint 9（eslint-config-next）
- 测试方案：暂无（以真机双设备验收 + 隔离恢复演练为准）
- 部署平台：Mac Mini Docker 自托管（规范 `2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md`）

### 常用命令

- 安装依赖：`npm install`；MCP 子包：`cd mcp/prompt-server && npm install`
- 本地开发：`npm run dev`（或 `./dev-server.sh start` 带 watchdog 自愈）
- 类型检查：`npx tsc --noEmit`（无独立脚本，next build 亦会检查）
- Lint：`npm run lint`
- 构建：`npm run build`；MCP 子包：`cd mcp/prompt-server && npm run build`
- 预览 / 生产启动：`npm run start`
- 服务管理：`./dev-server.sh {start|stop|restart|status|logs}`（watchdog 自愈）
- 测试：暂无脚本（待建立）

### 当前进展与产物索引

- 当前状态：P0/P1/P2 全部 CLOSED（2026-08-28）；**2026-09-01~09-03 Supabase 云端多端同步已完成并获 APPROVED_FOR_EXECUTION（2026-09-03 15:00 裁定放行）**：独立 `prompt_manager` Schema（6 表 + RLS + Realtime，`20260901163555` 已发布，Remote 5/5 含 habit_tracker 统一）、Auth（Magic Link + Google OAuth PKCE）、记录级 `revision`、MCP RPC、Docker 自托管、双设备验收（BUG-11/并发/MCP 隔离）、55 卡备份 + 隔离重放全绿；**收口材料已回填 §9/§10 并登记发布**，剩余 P1 已闭环（写队列 30s 超时已部署，冲突回归按用户决定搁置），P2/P3 观察项按转送清单待办；Mini 单设备安全运行期（`http://192.168.31.60:3100`）
- 需求文档：`docs/pm/提示词管理工具-需求文档.md`
- 产品报告：`docs/pm/产品报告.md`
- 实施计划：`docs/pm/PLAN.md`（Supabase 迁移已完成并放行，§16.18）
- 代码审查：`docs/review/CODE_REVIEW.md`（2026-08-26 基线，待 Supabase 增补）
- 产品优化候选：`docs/review/PRODUCT_BACKLOG.md`
- 交接上下文：`docs/handoff/HANDOFF.md`（§16.18 为当前唯一有效入口，2026-09-03 八次收束，裁定后+已发布）
- 质量记录：`docs/qa/BUGS.md`（BUG-9/10/11 FIXED，并发/MCP 隔离/备份全绿；待办 P1/P2/P3 见转送清单）、`docs/qa/QA_CHECKLIST.md`
- 规范：数据库 `2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md`（存于 `1.Active/alw丨数据库管理专家/`）+ Docker `2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md`
- 平台仓库：`/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库`（HEAD `2e92f08`，Remote 5/5 已发布，含 `20260901163555` + `20260903160500` 统一治理）
- 远程仓库：https://github.com/wanghoufan/prompt-manager.git（`master` 已整合，`origin/mcp-delivery` 已合入；本地 `061d807` 含 legacy 退场草稿待推送）
- 审查裁定：`/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/项目审查丨prompt_manager/收口审查裁定丨prompt_manager丨2026-09-03.md`（APPROVED_FOR_EXECUTION）
- MCP 接入说明：`mcp/prompt-server/README.md`
- 用户级模型执行指南（Stage Manager 只读引用）：`/Users/zzymima0000/.workbuddy/AI_MODEL_GUIDE.md`
- 治理文档（工作流 / 角色 / 门控 / 阶段 / 经验）：见 `AGENTS.md` §四

---

## 二、全局工作原则

1. 先理解现有实现，再修改代码。
2. 优先复用现有代码、组件、函数和数据结构。
3. 不擅自增加用户未要求的功能。
4. 不进行与当前任务无关的重构。
5. 尽量减少新增第三方依赖。
6. 修改完成后必须进行必要验证。
7. 不允许通过删除测试、绕过校验、隐藏错误来制造“通过”结果。
8. 代码和实际运行结果优先于过期文档。
9. 发现文档与代码冲突时，应明确记录并修正文档。
10. 密钥、Token、`.env*`、私密配置不得提交到 Git。
11. 临时脚本、实验副本、一次性分析、截图、中间产物统一放入 `scratch/`。
12. 不得把临时垃圾放入正式源码目录。
13. 禁止自行创建重复的项目管理类 Markdown；优先更新已有唯一权威文档。
14. 每个 Agent 只执行自己角色范围内的工作，除非用户明确授权跨角色处理。
15. 不确定时优先检查代码、运行结果和现有文档，不凭猜测下结论。

---

## 三、Agent 角色索引

> 角色规范文件统一放在 `docs/roles/`（已从模板复制建立）。日常启动只发送“中括号关键词 + 角色 + 当前任务”，Agent 自行读本文件与对应角色规范。

### 1. 技术规划师（Planner）
- 角色规范：`docs/roles/planner.md`
- 主要职责：理解需求、检查现有实现、分析影响范围、制定低风险实施方案、更新 `docs/pm/PLAN.md`；完成 PLAN 后检查并按需建立 / 补充 `QA_CHECKLIST.md` 核心回归基线。
- 默认不直接修改业务代码。

### 2. 开发实现工程师（Builder）
- 角色规范：`docs/roles/builder.md`
- 主要职责：按需求 / 计划实现功能、修改源码、基础自测、运行必要检查、修复已确认 Bug。

### 3. 代码审查工程师（Code Reviewer）
- 角色规范：`docs/roles/code-reviewer.md`
- 主要职责：独立审查代码、查找逻辑 Bug、数据一致性问题、性能 / 安全 / 可维护性风险、输出审查结果到 `docs/review/CODE_REVIEW.md`。
- 默认不直接修改业务代码。

### 4. 质量测试工程师（QA / Test Agent）
- 角色规范：`docs/roles/qa.md`
- 主要职责：实际运行和操作产品、正常 / 边界 / 异常 / 连续操作测试、完整实体生命周期测试、回归测试、记录 Bug 到 `docs/qa/BUGS.md`。
- 默认不直接修改业务代码。

### 5. 产品体验审查员（Product Reviewer）
- 角色规范：`docs/roles/product-reviewer.md`
- 主要职责：从产品经理、UX 和真实用户角度审查、发现功能完整性 / 易用性 / 效率 / 一致性问题、提出优化方向、维护 `docs/review/PRODUCT_BACKLOG.md`。
- 不负责传统代码审查。

### 6. 开发节奏与上下文管理（Stage Manager）
- 角色规范：`docs/roles/stage-manager.md`
- 主要职责：唯一的流程判断器；读取 Builder 技术交接 + PLAN + Git + QA / Review / Product 状态后，生成「当前唯一执行 Prompt」。
- 严格限制：本轮不得修改任何项目文件，只生成给 Builder 的执行 Prompt。

### 7. 开发经验记录（Experience Recorder）
- 角色规范：`docs/roles/experience-recorder.md`
- 主要职责：把开发经验、踩坑、协作改进沉淀到 `docs/DEV_EXPERIENCE.md`；相同经验合并、补充、升级成熟度。
- 不得自行升级正式规范（需用户授权）。

### 8. 工程 / 治理洁癖收尾（neat-freak）
- 角色规范：`docs/roles/neat-freak.md`
- 主要职责：Engineering Closeout；检查代码与文档是否一致、各权威文件是否过期、是否存在重复 / 过时 Markdown。
- 适用节点：大阶段完成 / 发布前 / 长会话交接 / 最终交付 / 文档失配时。

> 注：broader 方法论中另有 `【修复】`（Builder 复用 + 多报告综合）与 `【收尾】neat-freak` 两种运行模式，见第十节。

---

## 四、项目文档唯一归属表

| 信息类型 | 唯一权威位置 |
|---|---|
| 项目公共规则 | `AGENTS.md` |
| Agent 工作规范 | `docs/roles/` |
| 当前实施计划 | `docs/pm/PLAN.md` |
| 长期核心回归测试 | `docs/qa/QA_CHECKLIST.md` |
| 当前 Bug | `docs/qa/BUGS.md` |
| 当前代码审查结果 | `docs/review/CODE_REVIEW.md` |
| 产品优化候选 | `docs/review/PRODUCT_BACKLOG.md` |
| 当前交接上下文 | `docs/handoff/HANDOFF.md` |
| 人工编排流程 / 质量 / 收尾门控 | `docs/workflow/` |
| 当前开发阶段 / Builder 技术交接 | `docs/progress/CURRENT_STAGE.md` |
| 开发经验 | `docs/DEV_EXPERIENCE.md` |
| 可选模板（架构 / 决策 / 模型指南）| `docs/optional/` |
| 临时资料 | `scratch/` |

同一事实不要在多个位置重复维护。

---

## 五、Agent 启动规则

每个 Agent 开始工作前：

1. 先阅读根目录 `AGENTS.md`。
2. 确认当前被指定的角色。
3. 阅读该角色对应的 `docs/roles/*.md`。
4. 再读取当前任务真正需要的项目文档。
5. 阅读相关源码和测试。
6. 不要为了“了解项目”一次性读取所有无关文档。
7. 执行完成后，只更新自己职责范围内的权威文件。

---

## 六、角色与文档写权限建议

| 角色 | 源码 | PLAN | QA_CHECKLIST | BUGS | CODE_REVIEW | PRODUCT_BACKLOG |
|---|---:|---:|---:|---:|---:|---:|
| 技术规划师 | 默认否 | 是 | 建议 | 否 | 否 | 建议 |
| 开发实现工程师 | 是 | 可更新状态 | 否 | 可更新修复状态 | 否 | 否 |
| 代码审查工程师 | 否 | 否 | 建议 | 可记录 | 是 | 否 |
| 质量测试工程师 | 否 | 否 | 是 | 是 | 否 | 否 |
| 产品体验审查员 | 否 | 否 | 否 | 否 | 否 | 是 |

用户明确授权时例外。

---

## 七、临时文件规范

以下内容统一放入 `scratch/`，且默认不进入 Git：

- 调试脚本、实验性代码、临时数据
- 一次性分析、中间报告、临时导出
- 截图、试验副本

不得把临时垃圾放入正式源码目录。

---

## 八、文档管理规则

禁止随意新增类似 `FINAL_REPORT.md`、`QA_FINAL.md`、`TEST_SUMMARY_NEW.md`、`REVIEW_LATEST.md` 等重复文档。如果已有对应权威文件，应直接更新。只有现有文档体系无法承载必要信息时，才允许新增文档并说明原因。

进仓库 = `src/`、配置、`docs/` 交付物、真实测试套件；不进仓库 = `scratch/`、密钥、本地笔记、`node_modules/`、构建产物（由 `.gitignore` 强制）。

---

## 九、Git 与安全规则

1. 本项目已 `git init`（远程仓库未配置；首次推送需用户明确授权）。
2. 基线约定完成后建议先提交一次。
3. 阶段性正常 `commit` / `push`。
4. `scratch/`、构建缓存、依赖目录、密钥配置不得提交。
5. `.env*` 默认忽略；如需示例配置，只提交脱敏的 `.env.example`。
6. 不执行远程推送、删除分支、重写历史等高影响操作，除非用户明确授权。

---

## 十、neat-freak 使用约定

`neat-freak` 不用于每次小改动后的例行清理。建议在以下节点执行完整收尾：

- 一个较大开发阶段完成
- MVP / 版本发布前
- 长会话准备交接
- 项目最终交付
- 文档明显开始与代码失配时

收尾时重点检查：

- 当前代码事实与文档是否一致
- `AGENTS.md` 是否过期
- `PLAN.md` 是否仍准确
- 已解决 Bug 是否仍残留在 `BUGS.md`
- `QA_CHECKLIST.md` 是否需要补充长期回归案例
- `PRODUCT_BACKLOG.md` 是否混有已完成事项
- `HANDOFF.md` 是否能让新 Agent 直接接手
- `scratch/` 是否仍有应保留或应删除内容
- 是否存在重复、过时、冲突的 Markdown 文档

普通 commit、小 Bug、小样式改动无需执行完整 neat-freak。
