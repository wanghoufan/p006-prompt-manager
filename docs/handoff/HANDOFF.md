# 交接上下文 — Supabase 云端多端同步与数据库规范 V1.1

> 更新日期：2026-09-02
>
> 当前阶段：云端接入主体已完成；等待共享平台仓库 Migration 回写与真实双设备验收。
> 交接原则：先阅读本文件、`AGENTS.md`、`docs/pm/PLAN.md` 和数据库规范 V1.1；不要凭旧文档或浏览器缓存判断现状。

## 1. 本轮已完成

### 云端数据与认证

- 提示词管理器已接入共享 Supabase 项目的独立 `prompt_manager` Schema。
- Supabase Auth（Magic Link）登录、登录状态切换与云端初始读取已实现并实际登录验证。
- 用户已完成自定义 Schema 的 Data API Expose 配置。
- 已将三份本地来源离线合并后导入云端：52 cards、18 card_versions、24 tags、91 prompt_tags、1 settings；外键孤儿为 0。
- `settings.aiApiKey` 没有进入云端、导入包或 Git。

### 多端同步代码

- 浏览器通过 `src/lib/supabase/` 集中访问 `prompt_manager`，不回退到 `public`。
- cards、tags、settings 使用记录级 `revision` 条件更新；mutation 串行执行。
- 标签关系使用“先新增、后删除”的增量同步；版本历史为追加式写入。
- Realtime 监听 cards、card_versions、tags、prompt_tags、settings；初始读取和重连后仍会主动拉取。
- 旧 `localStorage` / `data/store.json` / `/api/sync` / SSE 仍是未登录或云端不可用时的兼容层，**不得**自动整份回写云端。

### MCP

- MCP 已不再读取 `data/store.json`，不使用 Supabase `service_role`。
- 每台设备使用独立、可撤销令牌；数据库只存 token hash；设置页可生成、查看元信息与撤销令牌。
- MCP 调取走 `prompt_manager.activate_prompt` RPC；已在真实 MCP 进程成功调取 `sop`，正文没有被输出到交接记录，复制计数按规则递增。
- 线上已修复 RPC 内 `code` 名称歧义（`#variable_conflict use_column` 与明确表别名）。

### 文档

- V1.0 已保留不动：`2026-09-01 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.0.md`。
- 新的生效规范：`2026-09-02 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.1.md`。
- V1.1 固化了云端主数据源、Data API Expose + GRANT + RLS 三道门、Auth 全局配置、MCP/`SECURITY DEFINER` 例外、紧急 SQL 回写 Migration、跨设备验收和恢复门禁。

## 2. 已验证结果

| 验证 | 结果 |
|---|---|
| `npm run lint` | 0 error；仅 `scratch/api-doc-test/run.mjs` 有 1 条旧的未使用变量 warning |
| `node_modules/.bin/next build --webpack` | 通过，包含 TypeScript 与静态页面生成 |
| `mcp/prompt-server` 的 `npm run build` | 通过 |
| MCP 实际云端调取 | 成功（调取码 `sop`） |
| 本机服务 | `http://127.0.0.1:3100` 首页返回 200 |

备注：默认 Turbopack 构建在当前受限环境会报创建进程/端口权限错误；Webpack 构建已经通过，不能把 Turbopack 的环境限制误报成业务代码失败。浏览器自动化工具当前不可用，因此没有把静态或 HTTP 检查写成“完整视觉验收”。

## 3. 未完成项与严格顺序

### P0：补齐共享平台仓库 Migration

线上 RPC 已修复，但正式 Migration 尚未回写。目标仓库：

```text
/Users/zzymima0000/Developer/coding/1.Active/平台丨共享 Supabase 数据库
```

目标文件已经创建但仍为空：

```text
supabase/migrations/20260901163555_fix_prompt_manager_activate_prompt_variable_conflict.sql
```

本会话曾被系统拒绝该外部仓库写权限；权限恢复后，下一位 Agent 必须先将线上已验证的同一 `create or replace function prompt_manager.activate_prompt(...)` 修复写入该文件、检查差异、在隔离环境或受控 SQL 中验证，再进行任何后续数据库发布。不要重新设计函数，也不要在未确认项目/Schema 的情况下再次执行生产 SQL。

### P1：真实双设备验收

需要用户配合至少一台另一设备（PC 或 MacBook Air），以同一账号登录并验证：

1. Mac 新建卡片，另一设备看到。
2. 另一设备修改卡片，Mac 看到。
3. 删除、标签关系、版本历史和复制计数同步正确。
4. 两端同时编辑同一记录时有明确冲突结果，不能静默覆盖。
5. 断网、重连、刷新后重新从云端读取。
6. 另一设备 MCP 使用自己的独立令牌；撤销其中一枚不影响其他设备。

### P2：旧链路处置

完成上述验收和恢复演练前，不删除 `data/store.json`、`/api/sync` 或 SSE 兼容链路。是否最终下线旧链路，应由用户明确决定并另开变更；不能借本次迁移顺手删除。

## 4. 关键文件

| 位置 | 作用 |
|---|---|
| `src/lib/supabase/config.ts` | 固定 `PROMPT_MANAGER_SCHEMA` 与公开配置读取 |
| `src/lib/supabase/promptRepository.ts` | 云端读取、Realtime、revision 写入、标签/版本 mutation |
| `src/lib/supabase/mcpTokens.ts` | 本地生成 token、哈希、列表与撤销 |
| `src/components/SupabaseAuthControl.tsx` | Magic Link 登录与 Auth 事件 |
| `src/components/McpCloudAccess.tsx` | MCP 令牌设置界面 |
| `mcp/prompt-server/src/index.ts` | 通过受限 RPC 调取云端提示词 |
| `mcp/prompt-server/.env.local` | 本机私密 MCP 配置；绝不读取、展示或提交 |
| `docs/pm/PLAN.md` | Supabase 迁移实现记录与验收边界 |
| `2026-09-02 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.1.md` | 后续所有工具的数据库接入规范 |

## 5. 工作区与 Git 注意事项

- 当前工作树有大量本轮代码和文档改动，尚未 commit 或 push；用户没有授权 commit/push。
- `next.config.ts` 和两份早期中文 SOP 文档在本轮开始前已存在用户改动/未跟踪状态，必须保留，不能作为本轮改动删除或覆盖。
- `.env*`、MCP 原始令牌、备份、导入中间文件不能进入 Git。
- 不执行 `git reset --hard`、`git checkout --`、删除 Schema 或生产数据操作。

## 6. 下次恢复建议

1. 先检查共享平台仓库写权限是否恢复；若未恢复，不能绕过限制，也不要重复尝试高影响操作。
2. 若权限恢复，优先完成 P0 Migration 回写和核验。
3. 然后请用户在另一台设备做 P1 验收；每一步只测试少量新建数据，先确认同步再继续。
4. 验收后更新 `docs/pm/PLAN.md` 和本文件；只有用户明确授权才 commit 或 push。

## 7. 2026-09-02 数据库治理决策

### 7.1 共享数据库长期规则

- 个人工具默认共用一个 Supabase 项目；每个工具使用独立的、小写蛇形命名 Schema。
- 业务项目不得直接使用其他工具的 Schema，不把业务表放入 `public`，也不得修改 Supabase 系统 Schema。
- 共享数据库结构的唯一权威来源是：
  `/Users/zzymima0000/Developer/coding/1.Active/平台丨共享 Supabase 数据库/supabase/migrations/`
- 真实业务数据以云端为主；`localStorage`、`data/store.json`、`/api/sync` 和 SSE 只能作为兼容或离线兜底，不能自动整库覆盖云端。
- 单用户个人使用不要求额外拆分开发库、测试库和生产库，但所有工具共用整个 Supabase 项目的额度、Auth、Realtime、Storage 等全局资源。

### 7.2 数据库审核职责

后续任何项目要接入或修改共享 Supabase，必须先提交数据库方案和完整变更材料，由数据库审核人独立审核。未经明确批准，不得建表、改表、改 RLS、改 GRANT、改 Expose、改 Function、改 Trigger、改 Realtime、改 Auth/Storage 全局配置或发布生产 SQL。

审核结果统一使用：

- `APPROVED_FOR_EXECUTION`：允许严格按已审核方案执行。
- `CHANGES_REQUIRED`：方案或材料需要修改后重新提交。
- `BLOCKED`：存在安全、权限、数据或跨项目影响阻塞。
- `VERIFIED`：执行完成，并通过结构、权限、功能和恢复复核。

最近完成接入的项目智能体负责提供代码事实、Migration 草案、测试证据和双设备验收材料；不得自己完成“实现、审核、批准、发布”的闭环。数据库审核人负责共享平台 Migration、权限与安全审核、最终放行和执行后复核。

对项目智能体的称呼必须统一：以下恢复提示词中的“你”专指执行提示词的项目接入智能体；“用户”专指项目所有者本人。项目智能体不得把“你”和“用户”混用，也不得把数据库审核人写成“我”。最终材料必须原样转交给“共享 Supabase 数据库审核人”。

### 7.3 当前接入项目的优先收口顺序

在提交最终数据库审核材料前，先按以下顺序完成：

1. 检查共享平台仓库写权限是否恢复。
2. 按线上已经验证的 RPC 修复内容补齐空的 Migration 文件：
   `supabase/migrations/20260901163555_fix_prompt_manager_activate_prompt_variable_conflict.sql`
3. 核验 Migration 内容、目标项目、线上函数状态和 Migration 状态；补齐文件不等于立即执行生产 `db push`。
4. 指导用户用另一台 PC 或 MacBook Air 完成真实双设备验收：双向新建、编辑、删除、标签、版本历史、MCP、断网重连和并发冲突。
5. 完成备份与恢复演练，并记录结果。
6. 在双设备验收和恢复演练全部通过前，保留 `data/store.json`、`/api/sync` 和 SSE 兼容链路。
7. 全部通过后，另行提交旧链路是否下线的变更申请；不得顺手删除。

如果第 1 步权限仍未恢复，应停止写入操作，提交阻塞报告和待审核材料；不得绕过权限，也不得自行修改生产数据库。

## 8. 下次恢复工作提示词

以下提示词可直接交给最近完成实际 Supabase 接入的项目智能体。提示词中的“你”指项目接入智能体，“用户”指项目所有者本人，“共享 Supabase 数据库审核人”指负责最终数据库审核和放行的角色：

```text
【继续完成 Supabase 接入收口任务】

你现在负责完成当前项目的接入收尾和验收材料整理，不是共享 Supabase 数据库的最终审核人。请严格按照以下顺序执行，不得跳步：

1. 检查共享平台仓库
   /Users/zzymima0000/Developer/coding/1.Active/平台丨共享 Supabase 数据库
   的写权限是否恢复。

2. 如果写权限已恢复，检查并补齐：
   supabase/migrations/20260901163555_fix_prompt_manager_activate_prompt_variable_conflict.sql

   内容必须与线上已经验证的 `prompt_manager.activate_prompt(...)` RPC 修复一致。不要重新设计函数，不要扩大变更范围，不要修改其他工具 Schema。补齐文件后，核验 SQL 内容、Git 状态、目标项目、线上函数状态和 Migration 状态。

   注意：补齐 Migration 不等于获得生产发布授权。不得自行执行生产 `supabase db push`，不得在 Dashboard 或 SQL Editor 中做其他数据库变更。

3. 指导用户使用另一台 PC 或 MacBook Air，以同一账号完成真实双设备验收：

   - Mac 新建卡片，另一台设备能看到；
   - 另一台设备修改卡片，Mac 能看到；
   - 双向删除、标签关系、版本历史同步正确；
   - MCP 使用另一台设备独立令牌，撤销其中一枚不影响其他设备；
   - 两端同时编辑同一条记录时出现明确冲突，不得静默覆盖；
   - 断网、重连、刷新后能重新从云端读取。

4. 完成备份与恢复演练，记录备份来源、恢复步骤、验证结果和是否有数据副作用。

5. 在双设备验收和恢复演练全部通过前，不得删除或停用：

   - data/store.json
   - /api/sync
   - SSE 兼容链路

6. 输出一份可直接提交给数据库审核人的 Markdown 文档，标题为：

   # 共享 Supabase 数据库接入收口材料

   文档必须包含：

   - 本次完成的工作；
   - Migration 文件、内容和状态；
   - 当前 Schema、表、Function、RLS、GRANT、Expose、Realtime 状态；
   - 双设备各项测试结果；
   - 备份与恢复演练结果；
   - 尚未验证或仍存在的问题；
   - 需要数据库审核人决定的事项。

   每项内容必须标记为“已验证、代码可见但未实际验证、待验证、存在问题”之一。不得把构建通过或单机 HTTP 200 写成双设备验收通过，不得输出密钥、MCP 原始令牌、数据库密码或真实提示词正文。

7. 明确确认：

   - 本次没有自行发布生产数据库变更；
   - 没有执行未经批准的 `supabase db push`；
   - 没有删除旧兼容链路；
   - 所有未完成事项都已列出。

完成后，将完整 Markdown 文档原样转交给共享 Supabase 数据库审核人，不得只提交摘要，不得改写为“已批准”，也不得自行宣布数据库收口。未经共享 Supabase 数据库审核人明确给出 `APPROVED_FOR_EXECUTION`，不得继续执行新的数据库结构、权限或生产发布操作。
```

## 9. 2026-09-02 恢复执行收口材料

> 当前结论：`BLOCKED`。已完成只读检查和 Migration 源文件准备，但生产 Migration 状态、双设备验收和恢复演练尚未完成，因此不能标记为 `VERIFIED`，也不能停用旧兼容链路。

### 9.1 Migration 与权限状态

| 项目 | 状态 | 证据/说明 |
|---|---|---|
| 共享平台仓库目录写权限 | 已验证 | 2026-09-02 重新执行 `test -w`，目录与目标文件均可写；但仓库尚无 HEAD，且所有文件仍未提交 |
| 目标 Migration 文件 | 代码可见但未实际发布 | `supabase/migrations/20260901163555_fix_prompt_manager_activate_prompt_variable_conflict.sql` 已包含 1,732 字节的 `create or replace function` 修复 |
| 修复内容 | 已验证 | 线上 `pg_get_functiondef` 已确认包含 `#variable_conflict use_column` 和同一令牌归属限制；Migration 的显式表别名写法与线上定义语义一致 |
| 生产数据库发布 | 未执行 | 本轮没有执行 `supabase db push`、Dashboard SQL 或其他生产写操作 |
| 线上 Migration 状态 | 已验证，未发布 | 项目仅登记 `20260901152616` 与 `20260901152750`；修复 Migration 尚未登记，不能把源文件存在误写成已发布 |
| 高权限 Function 审核 | 存在问题 | `activate_prompt` 仍为 `SECURITY DEFINER`，且 `anon` / `authenticated` 均有 EXECUTE；Supabase Advisors 给出两条对应 WARN，须由数据库审核人决定是否接受此能力令牌例外 |
| 本地 SQL 重放 | 待验证 | Docker 不可用，暂未完成本地 Supabase reset/replay |
| Git 状态 | 未提交 | 共享平台仓库仍有未提交文件；没有 commit 或 push |

说明：共享平台仓库的文件系统写权限已恢复，但这不等于获得生产数据库发布授权。后续仍需遵守唯一发布、审核和项目 link 核验流程。

### 9.2 当前数据库结构与安全边界

- 业务 Schema：`prompt_manager`。
- 当前可见业务表：`cards`、`card_versions`、`tags`、`prompt_tags`、`settings`、`mcp_access_tokens`。
- 当前可见数据库能力：RLS、归属字段 `owner_user_id`、记录级 `revision`、标签关系外键、`activate_prompt` RPC、Realtime publication。
- 浏览器代码通过 `supabase.schema('prompt_manager')` 访问，不使用 `public` 作为业务数据 Schema。
- 当前代码没有发现浏览器使用 `service_role` 的证据；MCP 使用独立令牌，数据库保存哈希。
- `prompt_manager.activate_prompt` 属于 `SECURITY DEFINER` 并允许 `anon` 执行；速率限制、审计记录、Security Advisor 结果和线上权限状态仍需单独核验，不能仅凭 Migration 文件标记为完成。

### 9.3 双设备验收状态

> 2026-09-02 补记：为规避 Supabase 邮件登录发送频率限制，项目登录菜单已增加 Google OAuth 入口；邮箱登录保留。Google Cloud OAuth 凭据和 Supabase Provider 启用尚待用户在控制台完成，尚不能作为已验收的登录方式。使用与现有邮箱相同的 Google 账号时，Supabase 会自动关联同邮箱身份；不同邮箱需单独评估身份关联和数据归属。

> 2026-09-02 修复补记：线上 Auth 日志已确认 Google OAuth `authorize → callback` 成功，且关联到既有云端账号；但浏览器端回跳后未显示会话。已将浏览器客户端从 implicit 改为 PKCE，并先注册 `onAuthStateChange` 再读取用户，避免回跳时漏掉 `SIGNED_IN` 事件。需由 PC 刷新页面并重新完成一次 Google 登录验证。

| 验收项 | 状态 |
|---|---|
| Mac 新建，另一设备读取 | 待用户配合验证 |
| 另一设备新建，Mac 读取 | 待用户配合验证 |
| 双向编辑 | 待用户配合验证 |
| 双向删除 | 待用户配合验证 |
| 标签关系同步 | 待用户配合验证 |
| 版本历史同步 | 待用户配合验证 |
| MCP 独立令牌与撤销 | 待用户配合验证 |
| 并发编辑冲突 | 待用户配合验证 |
| 断网、重连、刷新后重新读取 | 待用户配合验证 |

测试时只使用少量专用测试记录，避免把真实数据作为实验数据。每项需记录设备、时间、操作、云端结果和另一设备结果。

### 9.4 备份与恢复演练状态

当前未完成真实备份与恢复演练。后续至少需要记录：

1. 备份来源、时间和覆盖范围。
2. 隔离环境或 Sandbox 的恢复步骤。
3. 恢复后的表结构、行数、外键完整性、RLS 和 Function 状态。
4. `aiApiKey`、MCP 原始令牌等敏感内容未进入备份交付物或 Git。
5. 恢复是否造成数据副作用，以及恢复失败时的回退方式。

### 9.5 旧兼容链路

在双设备验收和恢复演练全部通过前，以下内容必须继续保留：

- `data/store.json`
- `/api/sync`
- SSE 兼容链路

是否停用这些链路必须另行提交变更申请，并经过数据库审核人和用户明确批准。

### 9.6 当前交付判定

本次不能给出 `APPROVED_FOR_EXECUTION` 或 `VERIFIED`。待完成事项为：

- 确认共享平台仓库的常规写权限和 Supabase 项目 link 状态。
- 审核并验证目标 Migration 可重放，确认 Git 与线上函数状态一致。
- 完成 Mac/PC 双设备全量验收。
- 完成备份与恢复演练。
- 更新共享平台仓库的 README 和数据库目录中已过期的状态说明。

## 10. Mac Mini Docker 自托管准备（2026-09-02）

- 用户已确定目标运行拓扑：Mac Mini 上单个 Prompt Manager Docker Web 容器；PC/其他 Mac 只通过 `http://Mac-mini.local:3100` 浏览器访问，不再各自运行 `localhost:3100` 服务。
- 开发源码唯一位置仍是当前仓库；正式服务目录约定为 `/Users/zzymima0000/Services/prompt-manager/`，业务兼容数据目录为 `/Users/zzymima0000/DockerData/prompt-manager/legacy-store/`，备份目录为 `/Users/zzymima0000/DockerBackups/prompt-manager/`。这三个项目级目录尚未由本轮创建。
- 本仓库已新增 Dockerfile、compose.yaml、.dockerignore，并将 Next.js 设置为 standalone 输出。compose 使用 bind mount 持久化旧 `data/store.json`；没有数据库容器或 Docker Named Volume，因为数据库仍是云端 Supabase。
- 正式启动前仍需：用户明确授权创建项目级生产/数据/备份目录；完成 Git 提交并按部署流程更新 Services 副本；在部署副本建立不提交的 `.env.local`；在 Supabase URL Configuration 与 Google OAuth 中加入精确 `http://Mac-mini.local:3100` 应用地址；再进行 Docker 构建与单机/LAN 验收。
- 本项不改变 Supabase Schema、RLS、Function、Migration 或数据库收口状态；第 9 节的 Migration、双设备、恢复演练和审核人门禁继续有效。

## 11. 额度受限交接检查点：0–3 已完成（2026-09-02）

> 本检查点只完成 Docker 准备和数据库收口顺序中的 1–3；**没有**启动正式容器、创建 Services/DockerData/DockerBackups 项目目录、执行 `supabase db push`、Dashboard SQL 或任何生产 Migration 发布。

| 项目 | 状态 | 本次证据 |
|---|---|---|
| 0. Docker 部署准备 | 已验证 | 本仓库的 `Dockerfile`、`compose.yaml`、`.dockerignore` 和 `docker/env.template` 已就绪；Next standalone、Compose 静态配置与 Docker 镜像构建通过。Docker 引擎为 linux/arm64，Mac Mini hostname 为 `Mac-mini`。没有运行容器。 |
| 1. 共享平台仓库写权限 | 已验证 | 在真实权限环境中，平台仓库及目标 Migration 文件均为可写。当前平台仓库没有 HEAD，所有内容仍为未跟踪，不能把“可写”误写成“已提交/已发布”。 |
| 2. RPC Migration 源文件 | 已完成，不需重写 | `supabase/migrations/20260901163555_fix_prompt_manager_activate_prompt_variable_conflict.sql` 已有 1,732 字节，SHA-256 为 `83dc8b36ef6a3a3105b09c74555a80e0cceecd9a615a7104eb22ae24f38adf62`；包含 `#variable_conflict use_column`、令牌哈希归属检查和显式表别名。文件不是空的，本轮未重复覆盖。 |
| 3. 目标项目与线上状态 | 已验证 | 通过只读 `supabase migration list --project-ref yacgnikzvutbpoqvokth` 确认：`20260901152616`、`20260901152750` 已在线；`20260901163555` 仅本地存在、线上为空，故尚未发布。`prompt_manager` Schema 下以一个不可能命中的随机令牌调用 RPC，返回 `HTTP 200 []`；没有提示词读取、复制计数或其他写入。 |

### 核验边界与已知事项

- 平台仓库尚未 `supabase link`；因此 `supabase migration list --linked` 会报 `LegacyProjectNotLinkedError`。本次改用显式 `--project-ref yacgnikzvutbpoqvokth` 完成线上 Migration 核验，未修改本地 link 配置。
- CLI 的 `supabase db query --project-ref` 不支持在未 link 项目上直接读取函数 DDL；本次以线上 RPC 无副作用探针验证运行状态，并保留先前已有的源文件/线上语义比对记录。不能把该探针写成完整 DDL 重放验证。
- 首次 RPC 探针未指定 Schema，得到针对 `public.activate_prompt` 的预期 404；补上 `Content-Profile: prompt_manager` 后为 200。后续任何 REST/RPC 核验必须明确指定业务 Schema，不能默认为 `public`。
- `activate_prompt` 的 `SECURITY DEFINER` 与 anon/authenticated EXECUTE Advisor 警告仍由共享 Supabase 数据库审核人决定；本轮没有处理或绕过它。

### 下一位智能体的唯一继续顺序

1. 先请用户在另一设备完成 P1 双设备验收；若采用 Docker，须先得到用户对创建 Services/DockerData/DockerBackups 项目目录、Git 提交和启动容器的明确授权。
2. 然后完成备份与恢复演练。正式 Docker 启动前，旧 `data/store.json` 只能先备份再复制到 `DockerData/prompt-manager/legacy-store`，绝不能移动或覆盖原文件。
3. 双设备验收和恢复演练全部通过前，继续保留 `data/store.json`、`/api/sync` 和 SSE。
4. 最后才生成《共享 Supabase 数据库接入收口材料》并原样交给共享 Supabase 数据库审核人；项目接入智能体不得自行宣布收口或发布 `20260901163555`。
