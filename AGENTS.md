<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md ｜ 提示词管理工具

> 多 Agent 协作总入口：公共规则 + 文档路由 + 角色索引。
> 各 Agent 动手前先读本文件，按归属目录读写，避免产物散落或重复生成。
> 协作方法论基线参考 `AI编程项目模板-手动协同-v2.1`。

## 〇、部署契约卡（Deploy Contract：涉及部署 / 容器 / 数据目录前必读）

> 本卡是 Docker 规范 V1.1 的浓缩速查，如有冲突以 V1.1 全文为准。

| 项 | 值 |
|---|---|
| project_slug | `prompt-manager` |
| 开发目录（唯一改源码处） | `~/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/` |
| 部署副本（GitHub 克隆，禁止手改源码热修） | `~/Developer/coding/docker/prompt-manager/` |
| 数据目录 | `~/DockerData/prompt-manager/`（含 `legacy-store/` bind mount） |
| 备份目录 | `~/DockerBackups/prompt-manager/` |
| 容器 / 端口 / 访问 | `prompt-manager-prompt-manager-1` ｜ `0.0.0.0:3100` ｜ `http://192.168.31.60:3100` |
| 唯一部署方式 | 改动 push 到 GitHub master 后，在**部署副本**内执行 `bash scripts/deploy.sh`（记录回滚点 → `git pull --ff-only` → compose build → up -d → HTTP 验证） |
| 部署前提 | 用户明确授权；部署副本已有 `.env.local`（600 权限，不进 Git） |

- 脚本分工：本项目日常部署**只用**上表的 `scripts/deploy.sh`；`~/Developer/coding/docker/deploy.sh` 是跨项目通用引导脚本（把新的 GitHub 仓库首次克隆成部署目录用），不用于本项目，避免产生第三份代码副本。
- 红线：未经用户明确授权，不创建 / 删除 / 迁移 / 覆盖 部署副本、DockerData、DockerBackups、Named Volume，不 commit/push，不新建生产容器或公开新端口；`dev-server.sh` 仅限开发，禁占 3100 端口。
- 完整规范：`~/Developer/coding/docker/2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.1.md`（与通用引导脚本同放 `docker/` 根目录；项目内同名 V1.0 文件已作废，仅作历史）。

## 一、项目档案

- 项目名称：提示词管理工具（Prompt Manager）
- 项目类型：Next.js 应用 + 共享 Supabase 云端存储 + Docker 自托管 + MCP 子包
- 当前阶段：Supabase 云端多端同步已完成并获 APPROVED_FOR_EXECUTION（2026-09-03 15:00 裁定放行），Migration 7/7 已发布（含 2026-09-04 BUG-13 `tags.revision` 修复）；剩余待办已于 2026-09-04 经用户最终裁定全部取消；**2026-09-10 完成 AI 服务商从 8 厂商收敛为 3 家（4 选项）并已上线生产（`1b569a5`）**；项目处于现状运行期（Mini 单设备，日常使用与被动故障响应）
- 主要目标：管理、编辑与测试提示词
- 主要用户：使用 GPT 等大模型、需要集中管理 Prompt 的个人 / 团队

### 技术栈

- 前端：Next.js 16（App Router）+ React 19 + TypeScript 5
- 服务端：Next.js Route Handler（AI 代理、`/api/mcp-access-tokens` MCP 令牌服务端生成）
- 共享存储：Supabase `prompt_manager` Schema（Postgres + RLS + Realtime，记录级 `revision` 条件更新，`owner_user_id` 归属）为主；`/api/sync` + `data/store.json` + localStorage 为未登录/离线兼容兜底（已获 APPROVED_FOR_EXECUTION；限期退场草稿已于 2026-09-04 经用户最终裁定取消、长期保留）
- 实时同步：Supabase Realtime（cards/card_versions/tags/prompt_tags/settings 5 表，`wss://…/realtime/v1/websocket`）；旧 SSE 链路仅作兼容保留
- 认证：Supabase Auth（Magic Link + Google OAuth PKCE），`http://192.168.31.60:3100` 为已核验访问地址（`localhost`/`.local` 不在白名单/被代理劫持）
- MCP：`mcp/prompt-server/`（`@modelcontextprotocol/sdk` + zod，stdio，v0.2.0 直连 Supabase RPC），工具 `prompt_manager_activate_prompt`（`prompt_manager.activate_prompt` RPC，能力令牌 SHA-256 哈希，`SECURITY DEFINER` 已裁定接受，2 WARN 存档）
- 部署：Docker 自托管（`prompt-manager-prompt-manager-1` 绑定 `0.0.0.0:3100`；正式部署副本 `Developer/coding/docker/prompt-manager/`（GitHub 克隆，规范 V1.1），一键部署 `bash scripts/deploy.sh`（前提：已 push master）；`DockerData/prompt-manager/legacy-store` bind mount，`DockerBackups/prompt-manager/` 备份不进 Git）
- AI 调用：通用 `AI_PROVIDER/AI_MODEL/AI_BASE_URL/AI_API_KEY`；**2026-09-10 从 8 厂商收敛为 3 家服务商 / 4 个选项 / 5 个模型**：`deepseek`（官方，`deepseek-v4-flash`）、`openrouter`（模型用户自填）、`opencode`（Zen，`glm-5.3-flash`）、`opencode-go`（`deepseek-v4-flash` + `glm-5.3-flash`）。**清单唯一来源 = `src/lib/ai/types.ts` 的 `AI_PROVIDERS`，须与 `SettingsModal.tsx` 的 `AI_SERVICES`、`factory.ts` 的 switch 分支三处同源**；历史配置指向已移除厂商时由 `normalizeSettings` 回退 `deepseek`。`docker/env.template` 为模板（env 回退仅在同厂商同源时生效），部署副本 `.env.local`（600 权限，不进 Git）
- 样式方案：Tailwind CSS v4
- 代码检查：ESLint 9（eslint-config-next）
- 测试方案：暂无（以真机双设备验收 + 隔离恢复演练为准）
- 部署平台：Mac Mini Docker 自托管（规范全文 `2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.1.md`，存于 `~/Developer/coding/docker/`；项目内同名 V1.0 已作废，见 §〇 部署契约卡）

### 常用命令

- 安装依赖：`npm install`；MCP 子包：`cd mcp/prompt-server && npm install`
- 本地开发：`npm run dev`（或 `./dev-server.sh start` 带 watchdog 自愈）
- 类型检查：`npx tsc --noEmit`（无独立脚本，next build 亦会检查）
- Lint：`npm run lint`
- 构建：`npm run build`；MCP 子包：`cd mcp/prompt-server && npm run build`
- 预览 / 生产启动：`npm run start`
- 服务管理：`./dev-server.sh {start|stop|restart|status|logs}`（watchdog 自愈，**仅开发用，禁止占生产端口**）
- 生产部署：改动 push 到 GitHub master 后，在部署副本执行 `bash scripts/deploy.sh`（`~/Developer/coding/docker/prompt-manager/`，一键拉取+重建+验证）
- 测试：暂无脚本（待建立）

### 当前进展与产物索引

- 当前状态：P0/P1/P2 全部 CLOSED（2026-08-28）；**2026-09-01~09-04 Supabase 云端多端同步已完成并获 APPROVED_FOR_EXECUTION（2026-09-03 15:00 裁定放行）**：独立 `prompt_manager` Schema（6 表 + RLS + Realtime，`20260901163555` + `20260904102000` BUG-13 已发布，Remote 7/7）、Auth（Magic Link + Google OAuth PKCE）、记录级 `revision`（含 `tags.revision` 修复）、MCP RPC、Docker 自托管、双设备验收（BUG-11/并发/MCP 隔离）、55 卡备份 + 隔离重放全绿；**收口材料已回填 §9/§10 并登记发布**，写队列 30s 超时 + BUG-12/13 已闭环，剩余待办已于 2026-09-04 经用户最终裁定全部取消；项目进入现状运行期（Mini 单设备，`http://192.168.31.60:3100`）。**2026-09-10**：AI 服务商由 8 厂商收敛为 3 家（4 选项）并已上线生产（`1b569a5`），同轮修复 D2（401 三层语义误判）与 BUG-8（env Key 跨厂商回退），dev 回环不水合已修
- 需求文档：`docs/pm/提示词管理工具-需求文档.md`
- 产品报告：`docs/pm/产品报告.md`
- 实施计划：`docs/pm/PLAN.md`（Supabase 迁移已完成并放行，§16.18）
- 代码审查：`docs/review/CODE_REVIEW.md`（2026-08-26 基线，待 Supabase 增补）
- 产品优化候选：`docs/review/PRODUCT_BACKLOG.md`
- 交接上下文：`docs/handoff/HANDOFF.md`（**§16.22 为当前唯一有效入口**，2026-09-10 十二次收束：AI 服务商收敛为 3 家已上线 + 遗留物处置 + 本地 dev server 停用；§16.21 及更早小节仅作历史记录）
- 质量记录：`docs/qa/BUGS.md`（BUG-9/10/11/12/13 FIXED；BUG-12=数据丢失事故，BUG-13=`tags.revision` 漏建已发布；**2026-09-10 第二十三次 QA（AI 服务商精简 + 上游错误提示分类）PASS，BUG-8（env Key 跨厂商回退）与 D2（401 三层语义误判）同轮收尾修复**；待办已全部取消）、`docs/qa/QA_CHECKLIST.md`
- 规范：数据库 `2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md`（存于 `1.Active/alw丨数据库管理专家/`）+ Docker `2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.1.md`（存于 `Developer/coding/docker/`；项目内 V1.0 已作废）
- 平台仓库：`/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库`（HEAD `2e92f08`，Remote 7/7 已发布，含 `20260901163555` + `20260904102000` BUG-13 修复 + habit_tracker 统一）
- 远程仓库：https://github.com/wanghoufan/prompt-manager.git（master 已整合 mcp-delivery；部署副本即从该仓库克隆）
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
| 根级 规范 / SOP **历史留档** | 项目根目录（`2026-08-31 …SOP 丨 V1.0.md`、`2026-09-01 …数据库规范 丨 V1.0.md`、`2026-09-02 …数据库规范 丨 V1.0 / V1.1.md`、`2026-09-02 …Docker 规范 丨 V1.0.md`）。**均为历史留档，顶部已加 HISTORICAL 横幅，禁止作为当前依据**；现行规范在项目外：数据库 V1.3 存 `1.Active/alw丨数据库管理专家/`、Docker V1.1 存 `Developer/coding/docker/` |
| 临时资料 | `scratch/` |

同一事实不要在多个位置重复维护。

> **根级规范历史留档为何不搬进 `docs/`**：这 4 份文件是当时会话的**决策沿革原件**，① 自身正文里的相对链接（如 `../../docker/…`、`../alw丨数据库管理专家/…`）是按**根目录位置**校准的，搬进 `docs/` 会全部失效；② `README.md` 与 `HANDOFF.md` 多处按**裸文件名**引用它们。故保留原位，只补 HISTORICAL 横幅与位置登记，不做搬迁（2026-09-10 洁癖收尾裁定）。

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

1. 远程仓库已配置：`https://github.com/wanghoufan/prompt-manager.git`（分支 `master`；部署副本即从该仓库克隆）。
2. 基线约定完成后建议先提交一次。
3. `commit` / `push` **逐次需用户明确授权**（推送口令：用户说「现在推送」后才可 `git push`）；用户提出推送需求时，先完成改动、验证、暂存、提交，并报告待推送内容，等第二次确认再推送。
4. `scratch/`、`coordination/`、构建缓存、依赖目录、密钥配置不得提交。
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
