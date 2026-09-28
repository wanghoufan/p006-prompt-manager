# AGENTS.md｜ORCA（全员遵守，一页）

## 两阶段治理（固定 9+1＋1 专项，不再新增角色）

- 状态：`PLAN / WAITING_HUMAN_APPROVAL / DEVELOP / PLAN_REOPEN_REQUIRED`（仅Change C受控重开期间；`PROJECT_PHASE` 当前值以 HANDOFF 为准）。
- Phase1（PLAN，用户口令`第一阶段，计划`）：只许 task-manager／supervisor／planner（Sol）／product-reviewer（显示名 Research Reviewer，内部 ID 不变，模型/通道以 override 表为准）；禁 builder／code-reviewer／qa 派工，禁业务代码改动，禁 Release。PLAN 链：Planner→Research Reviewer→Planner→…→Readiness Gate→Human Gate；用户不搬运反馈（TM 自动回传）；`PLAN_READINESS_SCORE>=90` 且模板 Gate 全条件满足（P0=0＋blocking P1=0＋关键事实已验证＋核心假设已合理验证）才进 WAITING（定义以 `docs/pm/PRODUCT_PLAN.template.md` 为准，卡内不另写）。
- Human Gate：`WAITING_HUMAN_APPROVAL`（`PLAN_GATE=READY_FOR_HUMAN_REVIEW`）时 TM 停循环只找人一次，不可自动跨越，不可自行启动 builder；只有用户明确说`第二阶段，开发`才进 Phase2。
- Phase2（DEVELOP）：锁定 `DEV_BASELINE=PRODUCT_PLAN_Vx.x`，默认主链 Builder→Reviewer→QA→Supervisor→TM（模型以 override 表为准）；禁随意改 Plan（Plan 变更只走 Change C Controlled Reopen＋Human Approval＋新版本＋新基线）；product-reviewer（Research Reviewer）默认不派，recorder/neat 只在收尾派。
- Change Request（用户口令`变更请求：……`，TM 分类）：`CHANGE_REQUEST: NONE / A / B / C`——A=开发内小改留 DEVELOP 不召 Planner；B=局部功能变化更新局部 Requirement/DoD 留 DEVELOP 不召 Sol Planner；C=产品/架构变更进 `PLAN_REOPEN_REQUIRED`，局部暂停＋Sol Planner＋Research Reviewer＋Human Approval＋新 Plan 版本＋新 DEV_BASELINE 回 DEVELOP，不全量重跑。
- 独立重申：task-manager（唯一对人说话）与 supervisor（只对编排者说话）保持独立，不合并；无 Spark Gate；无额度状态机字段。
- 升级保留：同一 Task 累计被 supervisor 打回 2 次自动升 senior-expert（Sol），或编排者判定 P0-hard 手动升；senior 接手后被打回 2 次即停线找人（详见本文件升级节）。

## 角色（9 常驻 + 1 升级专用 + 1 专项，不再新增）

task-manager=编排者（唯一对人说话）｜supervisor=监督者（只对编排者说话，编排者失联时除外）｜planner｜builder｜code-reviewer｜qa｜product-reviewer（显示名 Research Reviewer，内部 ID 不变）｜experience-recorder｜neat-freak｜senior-expert=高级开发（只接升级任务）｜db-admin=数据库管理员（专项，TM 直派直收，用户不中转）。职责看 `docs/roles/`，一句话一张。

## 谁写哪（写错地方打回）

| 谁 | 写哪 | 模板 |
|---|---|---|
| planner | `docs/pm/` | Phase1照PRODUCT_PLAN.template.md；Phase2照PLAN.template.md |
| builder | 业务仓库本身 | — |
| code-reviewer | `docs/review/` | CODE_REVIEW.template.md |
| qa | `docs/qa/` | BUGS.template.md |
| product-reviewer（Research Reviewer，ID 不变） | `docs/review/` | RESEARCH_REVIEW.template.md（Phase1；PRODUCT_BACKLOG.template.md 保留兼容） |
| task-manager | `docs/handoff/` | HANDOFF.template.md |
| supervisor | 无独立文档，打回写被检文件评论区 | — |
| experience-recorder | 根 `经验一句话.md`，追加一句 | — |
| neat-freak | 改对应 docs 原文+交接记一笔 | — |
| db-admin | 平台审查仓（结论回执 TM 落 HANDOFF） | 照 supabase 规范 §16 三态＋§16.2 八字段＋§17 |
| senior-expert | 业务仓库本身（只接升级任务） | — |

业务文件（src/assets/配置/AGENTS.md/旧交接）原地不动；搬了会 broken 的留原地记映射。

## 派工顺序（Phase-aware；旧单线默认链已废止）

Phase1（PLAN）：planner（Sol）→product-reviewer（Research Reviewer）→planner→…→Readiness Gate→Human Gate（禁 builder／code-reviewer／qa／业务改动／Release）。Phase2（DEVELOP）：builder 写→code-reviewer 复核→qa 测→supervisor 复检→编排者收齐找人（默认主链，模型以 override 表为准；product-reviewer 默认不派）。真机QA每session先过能力预检PASS才进正式，否则停（详情见qa卡）。经验/neat-freak 只在收尾派一次。本窗口内派 subagent，全自动（默认派工口；执行通道按 override『执行通道/Runtime』列，表定通道（codebuddy/codex/opencode）的走通道直调，禁套娃）。三类例外（人肉调试/外部施工/迁移基线）可起终端，见编排者提示词 :10。基础设施活必带 docs/sop/ 对应规范（DB 带 supabase.md 或 sqlite.md，部署带 docker.md），supervisor 抽查。
跳步：单文件小修可跳 planner/product，不可跳 code-reviewer+qa+supervisor；跳了记一句原因。分歧听谁的：技术分歧听 code-reviewer，范围分歧听 Task Manager。
- Decision Sidecar（非角色，不占 9+1+1）：TM 仅规则无唯一答案时调 `scripts/decision/orca-decide.mjs`（照 docs/sop/decision-router.md），advisory only，失败回 V2.1 逻辑；supervisor 抽查调用点合规。
续 session：同一功能/Bug 链（开发→QA→返工→再 QA）尽量续上一个 session（codex/opencode 用 resume），不要每轮新开；返工派必须续。用完不急着关，关了重开更贵。resume 由派工基础设施保持，编排者不手动开终端；升级换 senior-expert 时开新链，不续旧 session。
- External Builder Runtime 通用插座：builder 仍是 builder（9+1＋1 不新增），Runtime 仅为执行通道（本窗口 subagent / codex / opencode / External Runtime），由 override「执行通道/Runtime」列或口头指定、派工基础设施自动调用；Runtime 自带 internal reviewer/QA/self-check 仅为自检证据，不能替代 code-reviewer/qa/product-reviewer/supervisor；permission_request 走机器可读→ORCA/TM 审批单点→用户定→回 runtime，builder 不直聊用户；禁把通道角色包进本窗口subagent套娃调用（表定codebuddy/codex/opencode的角色必须走通道直调），违者打回。

## 模型

- 数据库审核（db-admin，专项，不占 Phase 主链）：TM 直派直收（审查材料→三态结论），结论记 HANDOFF，不经过 Human Gate；supervisor 抽查结论格式与三态口径。
每次派前读根 `USER_MODEL_OVERRIDE.md`，有就用它（11行以表为准）。精确 ID，照抄执行（TM行例外：开窗口时定）。表内无备用列：换人用户直接改母版真源表；DISPATCH 的 used 恒填主，supervisor 抽查实派==表。换谁、用到几时，用户定。改表后必须真调验证可用才生效（烧额度先经用户批；只读验名免费先行，不通即停，表不动）。分工表软链制：各项目根表均为软链，指母版真源，改母版即全项目同步（禁拷实文件；跨机器断链时拷实文件并记 HANDOFF）。

## 升级（普通→高级，只对当次任务）

- 触发：① 同一 Task 累计被 supervisor 打回 2 次自动升（QA 挂不算，只算 supervisor 打回） ② 编排者判定 P0-hard 手动升。满足一条即升。
- 计数口径：rework=被 supervisor 打回次数；QA 挂/自修好不计数，不断链也累计。
- 只升当次，不永久转正。换模型/换 Runtime 即开新链（旧链结论进 HANDOFF，缓存不跨链）。升级原因 + 返工次数记进任务账本。senior 接手后不再计数升级，被 supervisor 打回 2 次即停线找人（列阻塞＋要拍的板，不再升，无更高角色）。
- senior 模型读 `USER_MODEL_OVERRIDE.md` 的 senior-expert 行。

## 任务账本（换模型的依据，一个项目一个文件）

- 文件：`docs/model/TASK-MODEL-LOG.jsonl`，一行一任务，跨项目同名同 schema，分析时拼起来直接统计。模板自带的 `{"_example":true}` 行不参与统计，首个真实任务前删除。example 行由迁移整理工/首个 TM 在首个真实任务前删除。
- schema（全单行，枚举锁死：11 必需键＋note 可选扩展键）：`{"task","project","date","role","model","result":"PASS/FAIL","rework":数字,"escalated":"YES/NO","escalation_reason":null或一句,"tokens":数字或null,"cost_cny":数字或null,"note":可选}`。`cost_cny` 与 `tokens` 拿不到填 `null`，不许编；`project`=仓库根目录名（HANDOFF Stage ID 括号备注，如 radar-live），`date` 取 `YYYY-MM-DD`。
- 分工：builder/senior 写一行初版→supervisor 校验 JSON 合法+返工数→编排者判结果落盘。
- `result`=任务级 PASS/FAIL（按表派单成功仍可 PASS；FAIL 须配 escalation_reason/备注说明是任务挂还是模型挂）。
- 逐派记录：每次派工收工编排者往 `docs/model/DISPATCH-LOG.jsonl` 记一行（schema：date/task/role/model/used恒填主/runtime（本窗口/codebuddy/codex/opencode/—）/result PASS或FAIL/note（切备时used仍填主＋note记切备原因，HANDOFF补一句）；示例行不参与统计，首个真实派前删除；tokens/cost不记；寿命随任务账本归档）；与派工显式两行互验；supervisor抽查实派==表三处对得上。
- 两包同步：母版治理改动提交后同步两本地包（`新项目模板包/`、`老项目迁移模板包/`）并在 HANDOFF 记一行；`diff` 非预期差零容忍（常驻同步，用户定）。
- 换模型决策先读账本：返工多、常升级的任务类型优先换强模型。

## 缓存五条（各家通用，够用就行；本窗口 subagent 链适用，External Runtime 走 builder 通道，换 Runtime/换模型/升级即开新链，见编排者 :10-11；外部施工见外部提示词）

- 静态打头：派工先读同一批文件，顺序全体系唯一：AGENTS→角色卡→override 表→HANDOFF→经验一句话→（涉基础设施加 docs/sop/ 对应规范）→任务目标放最后。prefix 稳定命中，谁也不许自创顺序。
- 动态押后：任务目标、git 状态、时间戳、随机 ID 永远放最后，system prompt 前面只放不变的东西。
- 同链续 session：一链之内不换派工基础设施与会话链（角色/工具按任务换，prompt 模板不变）；要换基础设施即开新链重起。
- 长了就压：超约 100k token（编排者估，用户可改）即写 HANDOFF 快照后开新链，旧链结论进 HANDOFF，历史扔掉。
- 缓存 best-effort，几小时到几天过期正常，不定 KPI，只定动作。

## 红线

- P0 没完+人没喊停，不准收工，不准“先到这里”。
- 每轮末三行心跳：目标/剩 P0/下一步。
- 不 push（commit 需编排者明确指令，含分支名，外部者用 `ext/` 开头）；不碰 secrets；不改旧版封存；`docs/sop/` 为基础设施规范位（docker.md/supabase.md/sqlite.md/android.md/webqa.md/decision-router.md，去版本号引用），新项目自建（包内历史交接不动）。
- 换模型的事用户决策，不许自作主张、不许写恢复类条件。
- 总监督（体系外独立，不占9+1，编排者无权派工/解雇）：只读 AGENTS＋`docs/prompts/Orca 编排治理监督者提示词.md`（先读顶部收编说明，wake-only）＋HANDOFF 并按监督者提示词执行，监督编排者是否持续推进、防停摆；平时只喊编排者，禁主动问用户，同一停摆两次叫不醒才找用户一次；与体系内 supervisor（监督者）无关，不合并；质量判定走 supervisor 链，推进/停摆判定听总监督。

## 本目原有规则（迁移自旧 AGENTS.md）

> 2026-09-23 迁移整理：旧版已备份为 AGENTS.md.旧版-2026-09-13；本项目专属规矩原文原样附后，不丢规矩。


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
- 项目类型：Next.js 应用 + 本地 SQLite 主存储（Supabase 云端为回退路径，用户 2026-09-28 裁定保留）+ Docker 自托管 + MCP 子包
- 当前阶段：Supabase 云端多端同步已完成并获 APPROVED_FOR_EXECUTION（2026-09-03 15:00 裁定放行），Migration 7/7 已发布（含 2026-09-04 BUG-13 `tags.revision` 修复）；剩余待办已于 2026-09-04 经用户最终裁定全部取消；**2026-09-10 完成 AI 服务商从 8 厂商收敛为 3 家（4 选项）并已上线生产（`1b569a5`）**；项目处于现状运行期（Mini 单设备，日常使用与被动故障响应）。**2026-09-13**：P0 标签 FK 修复（`989e321`）+ 吐司刷屏返修（`0ea4339`，同 job 补推父行 + 吐司去重）已上线，BUG-14 FIXED。**2026-09-16**：左右面板自由拖宽（`1d4d589`）+ 回收站/标签`父/子`全路径显示（`2d49adf`，真机 QA PASS，73 卡归位）已上线。**2026-09-28**：存储从 Supabase 迁移为本地 SQLite（`1ba17df`，db/migrations 机制，DockerData bind mount）+ 全库代码审查（无 P0）+ 卡片重复修复（`b1bf1af`）+ Composer 三开关持久化修复（`d25d881`）均已上线；Supabase 回退路径保留（用户裁定），局域网信任模型维持现状（用户裁定）
- 主要目标：管理、编辑与测试提示词
- 主要用户：使用 GPT 等大模型、需要集中管理 Prompt 的个人 / 团队

### 技术栈

- 前端：Next.js 16（App Router）+ React 19 + TypeScript 5
- 服务端：Next.js Route Handler（AI 代理、`/api/mcp-access-tokens` MCP 令牌服务端生成）
- 主存储：本地 SQLite（`data/prompt-manager.db`，node:sqlite + WAL；结构变更走 `db/migrations/*.sql`，访问集中在 `src/lib/serverStore.ts` + `src/lib/db/sqlite.ts`；全量快照 + baseVersion 乐观并发）；Supabase 回退分支保留（`src/lib/supabase/promptRepository.ts`，`NEXT_PUBLIC_SUPABASE_*` 留空即自动降级本地模式）
- 实时同步：服务端 SSE（`/api/sync/stream` 版本号广播）；Supabase Realtime 仅回退模式使用
- 认证：本地模式无需登录；Supabase Auth（Magic Link + Google OAuth PKCE）仅回退模式，`http://192.168.31.60:3100` 为已核验访问地址
- MCP：`mcp/prompt-server/`（`@modelcontextprotocol/sdk` + zod，stdio，v0.2.0 走 `/api/mcp/activate` 直连本地 SQLite），工具 `prompt_manager_activate_prompt`（能力令牌 SHA-256 哈希存 `mcp_access_tokens` 表）
- 部署：Docker 自托管（`prompt-manager-prompt-manager-1` 绑定 `0.0.0.0:3100`；正式部署副本 `Developer/coding/docker/prompt-manager/`（GitHub 克隆，规范 V1.1），一键部署 `bash scripts/deploy.sh`（前提：已 push master；注意 PATH 避坑见 §十一）；SQLite 主库 bind mount 至 `DockerData/prompt-manager/`，`DockerBackups/prompt-manager/` 备份不进 Git）
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
- 交接上下文：`docs/handoff/HANDOFF.md`（**§16.28补3 为当前唯一有效入口**，2026-09-16：回收站 + 标签全路径显示真机 QA PASS 收工；§16.23–16.28 为 P0 FK/吐司/拖宽收敛过程，§16.22 及更早小节仅作历史记录）
- 质量记录：`docs/qa/BUGS.md`（BUG-9/10/11/12/13/14 FIXED；BUG-12=数据丢失事故，BUG-13=`tags.revision` 漏建已发布，BUG-14=标签 FK 裸错已除；**2026-09-10 第二十三次 QA（AI 服务商精简 + 上游错误提示分类）PASS，BUG-8（env Key 跨厂商回退）与 D2（401 三层语义误判）同轮收尾修复**；**2026-09-16 回收站 + 标签全路径显示真机 QA PASS（删→站→恢复→清空，73 卡归位）**；待办已全部取消）、`docs/qa/QA_CHECKLIST.md`
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

---

## 十一、踩坑经验

> 项目级踩坑条目统一归此节，集中存放，便于日后统一整理、升级为用户级经验文档。格式：日期 + 场景 + 现象 + 原因 + 解法，一条一行。

- **2026-09-28 ｜ Docker 部署 ｜ 凭据助手 PATH 缺失**：终端手动跑 `deploy.sh` 报 `error getting credentials - err: exec: "docker-credential-desktop": executable file not found in $PATH`，构建失败（容器仍跑旧版）。原因：本机 `which docker` 指向 `~/.local/bin/docker`，PATH 里没有 Docker Desktop 的凭据助手目录，BuildKit 拉取 syntax 镜像时凭据失败。解法：`export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` 后重跑 `deploy.sh` 即成功（已验证）。非脚本问题，脚本无需改。
