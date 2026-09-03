# 交接上下文 — Supabase 云端同步、数据库 V1.2 与 Docker V1.0

> 更新日期：2026-09-04
>
> 当前阶段：裁定后收尾期。P1 写队列修复已部署；P2 legacy 退场申请草稿待管理员审批；**BUG-12 数据丢失修复已提交（`5c2359c`）待用户授权部署**；Mini 单设备安全运行期。用户长期只用 Mini 单设备，**任何会话不得要求/建议双设备测试**。
> 交接原则：先阅读 `AGENTS.md`、本文件 **§16.19（当前唯一有效入口）**、数据库规范 V1.3 和 Docker 规范 V1.0；不要凭旧文档或浏览器缓存判断现状。

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
/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库
```

## 16.10 阶段暂停交接（2026-09-02；当前唯一有效入口）

> 用户指示“开发先到这里暂时结束”。本节取代 §16.9 及更早的恢复提示；接续者必须从本节恢复，不得把历史任务顺序当作当前授权。

### 当前工作进展

| 事项 | 状态 | 已验证事实 / 边界 |
|---|---|---|
| 数据库治理 | ✅ 规范已更新 | 当前生效：`2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md`；V1.0/V1.1 仅作历史记录 |
| Docker 治理 | ✅ 已独立成规范 | 当前生效：`2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md`；明确开发、部署、持久化、备份和云厂商迁移边界 |
| Supabase 云端主数据与登录 | ✅ 已验证 | 项目 `yacgnikzvutbpoqvokth`；Mini 已登录并读取云端 53 张卡；登录后 Supabase 是主数据源 |
| 当前使用方式 | ✅ Mini 单设备运行 | 用户暂时只在 Mini 的已登录云端页面使用；重要新增保存后刷新确认，并定期导出；这不是多端验收或数据库收口 |
| Docker 正式 Runtime | ✅ 运行中 | 既有 `prompt-manager-prompt-manager-1` 容器绑定 3100；Docker 构建与首页 200 通过，但不等于云端写入、多端或 RLS 验收 |
| 备份与恢复 | ✅ 演练完成 | 结构/数据备份在 `DockerBackups/prompt-manager/`；隔离恢复演练全绿；备份不进 Git |
| BUG-9 / BUG-10 | ✅ Air 真机通过 | MCP 令牌服务端生成、HTTP 剪贴板回退已部署；Mini 未复测 |
| BUG-11 | ⏸️ 用户指定暂缓 | 跨端回读时新卡可能被旧快照覆盖；修复代码已部署但未完成硬刷新后的双设备真机验证；不得标为已修复 |
| 并发冲突与 MCP 双设备隔离 | ⏸️ 暂缓 | 需要第二个独立设备/会话；用户目前只使用 Mini，不能伪造通过 |
| 数据库发布 | 🔒 未收口 | `20260901163555` 未发布；接入智能体不是数据库审核人，不得 `supabase db push`、改 Dashboard 或自行收口 |
| 兼容链路 | 🔒 保留 | `data/store.json`、`/api/sync`、SSE 未删未停；旧 JSON 不是唯一副本，也不得自动覆盖云端 |
| Git 工作树 | ⚠️ 未提交 | 存在 MCP、AI、Docker、文档、`supabase/` 等未提交/未跟踪改动；不得 reset、checkout、覆盖、删除、commit 或 push，除非用户明确授权 |

### 下一步任务

1. **当前无需继续开发**：用户只在 Mini 单设备模式使用。重要新增后等待写入完成、刷新确认，再定期导出；不让其他旧客户端、旧 JSON 或脚本写入同一数据集。
2. **恢复多设备前先处理 BUG-11**：所有参与设备硬刷新；Mini 新建无敏感测试卡，另一设备产生一次云端变更；确认卡不消失、刷新后仍在，再由 Mini MCP 调取。若仍失败，停止重复尝试，捕获真实浏览器保存错误；不得猜测或拿旧 JSON 掩盖。
3. **随后完成并发冲突验收**：保留 Mini 的旧编辑版本，另一设备先保存，再尝试提交 Mini 旧版本；必须看到明确冲突处理，不能静默覆盖。
4. **随后完成 MCP 双设备隔离**：两台设备各自独立令牌并均实际调取同一无敏感测试卡；仅撤销其中一枚，确认另一枚继续可用。
5. **最后才走收口**：QA 只记录实际结果。BUG-11、并发冲突、MCP 隔离均通过后，生成完整《共享 Supabase 数据库接入收口材料》，全文原样交给共享 Supabase 数据库审核人；审核人决定批准、修改或阻止，接入智能体不得自行宣布完成。

### 注意事项与相关规矩

1. **先读两份规范**：数据库接入只按 V1.2；部署、自托管与云迁移只按 Docker V1.0。两份文档按“数据库 / Runtime”分工，不重复维护。
2. **目录边界**：日常源码只在 `/Users/zzymima0000/Developer/coding/1.Active/` 下修改；部署副本在 `/Users/zzymima0000/Services/<project_slug>/`；真实文件在 `DockerData/<project_slug>/`；备份在 `DockerBackups/<project_slug>/`。Services 不是日常开发目录。
3. **运行时边界**：3100 被 Docker 占用，绝不运行 `./dev-server.sh start`。没有用户明确授权，不更新 Services、不重建容器、不创建/删除生产目录、不动 DockerData、DockerBackups 或 Named Volume。
4. **访问与认证**：当前 Mini 使用 `http://192.168.31.60:3100` 的已登录页面；不得混用 `localhost`、`127.0.0.1` 或 `.local`。若 LAN IP 改变，先停下并由用户决定是否调整 Auth 白名单和 OAuth 回调。
5. **数据安全**：不回显或记录 AI API Key、MCP 原始令牌、数据库密码、Auth token、真实提示词正文。`.env.local` 不进 Git；`NEXT_PUBLIC_*` 只能是公开构建变量。
6. **数据库禁区**：不得发布 `20260901163555`、不得运行未经批准的 `supabase db push`、不得改 Dashboard、不得新增数据库功能；旧 JSON、`/api/sync`、SSE 在审核批准前一律保留。
7. **验证口径**：Docker Up、HTTP 200、TypeScript、Lint 均不等于云端持久化或跨设备验收。只接受有设备、操作和结果记录的实际测试。

### 下一个智能体接续恢复提示词（一键复制）

```text
【恢复 Prompt Manager 单设备运行与 Supabase 收口】

你现在是「项目接入智能体」，不是共享 Supabase 数据库审核人。项目目前处于暂停状态；先维护 Mini 单设备安全运行，不得擅自继续多端测试、数据库发布或新功能开发。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

开始前按顺序完整阅读：
1. AGENTS.md
2. docs/handoff/HANDOFF.md —— **§16.10 是当前唯一有效入口**
3. docs/pm/PLAN.md
4. 2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md
5. 2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md
6. docs/qa/BUGS.md —— 重点 BUG-9、BUG-10、BUG-11

当前事实：
- Mini 当前只在 `http://192.168.31.60:3100` 的已登录云端页面使用；登录后 Supabase 是主数据源。重要新增必须在保存后刷新确认，并定期导出。
- Docker 容器 `prompt-manager-prompt-manager-1` 已运行并占用 3100；禁止 `./dev-server.sh start`。
- 备份与隔离恢复演练已完成；旧 `data/store.json`、`/api/sync`、SSE 仍必须保留。
- BUG-9、BUG-10 已在 Air 真机通过；BUG-11（跨端新卡可能被旧 Realtime 快照覆盖）是用户指定暂缓项，修复虽已部署但未完成双设备真机验证。
- 并发冲突和 MCP 双设备隔离均暂缓；不得把它们写成通过，也不得生成数据库收口材料。
- 数据库规范 V1.3 与 Docker 自托管规范 V1.0 已完成并生效；V1.0/V1.1 数据库规范保留为历史记录。
- `20260901163555` Migration 未发布；你不得执行 `supabase db push`、改 Supabase Dashboard、发布 Migration、接入新数据库功能或自行宣布收口。
- 工作树有未提交/未跟踪改动。先检查 `git status`，绝不 reset、checkout、覆盖、删除、commit 或 push，除非用户明确授权。

恢复工作顺序：
1. 若用户仍只用 Mini：不做多端开发；只协助单设备安全使用、导出和只读状态核验。
2. 若用户要求恢复多设备：先验证并修复 BUG-11（硬刷新 → 无敏感测试卡 → 另一端变更 → 刷新后仍在 → Mini MCP 调取）；失败时抓取真实浏览器保存错误，停止猜测与重复尝试。
3. BUG-11 通过后，依序实测并发冲突、MCP 双设备独立令牌与撤销隔离；QA 写入真实结果。
4. 全部通过后，生成完整《共享 Supabase 数据库接入收口材料》并原样交共享 Supabase 数据库审核人，由审核人决定是否放行。

硬性禁区：
- 未经用户明确授权，不改 Services、不重建容器、不动 DockerData / DockerBackups / Named Volume、不 commit、不 push。
- 不泄露任何密钥、原始令牌、数据库密码、Auth token 或真实提示词正文。
- 不删除/停用 `data/store.json`、`/api/sync`、SSE；不把 Docker HTTP 200、构建或静态检查写成云端/多端验收通过。
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
  `/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库/supabase/migrations/`
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
   /Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库
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

## 12. Docker 正式部署完成（2026-09-02，用户已授权）

> 用户明确授权后，按既定顺序完成了正式 Docker 部署。本项只改变运行时（Runtime 层），不改变 Supabase Schema、RLS、Function、Migration 或第 9 节的收口状态。

| 事项 | 状态 | 证据/说明 |
|---|---|---|
| 三个生产目录创建 | 已验证 | `/Users/zzymima0000/Services/prompt-manager/`、`/Users/zzymima0000/DockerData/prompt-manager/legacy-store/`、`/Users/zzymima0000/DockerBackups/prompt-manager/` |
| 旧数据备份→复制 | 已验证 | 原文件未动；备份 `store.json.bak-20260902-115412`，复制到 `legacy-store/store.json`；三份 SHA-256 一致（`2557e4f9…c2bb1`，143,090 字节） |
| 项目 Git 提交 | 已验证 | `bb32e42`（32 文件，+4459/−231，含 Supabase 集成、Docker 模板、规范文档）；仅 commit、未 push |
| Services 部署副本 | 已验证 | rsync（排除 .git/node_modules/.next/scratch/data/.env* 等）；`.env.local`（600 权限、不提交）已建 |
| 容器启动 | 已验证 | `prompt-manager-prompt-manager-1` Up，绑定 `0.0.0.0:3100`；`restart: unless-stopped`；bind mount `DockerData/prompt-manager/legacy-store -> /app/data`（容器内可见 store.json 143,090 字节） |
| HTTP 验证 | 已验证（单机） | `http://127.0.0.1:3100` 200；`http://Mac-mini.local:3100` 200；`/api/sync` 兼容链路 200。**这只是单机验证，不等于双设备验收** |
| 本机 LAN IP | 已验证 | `192.168.31.60`（PC 在 `.local` 解析失败时的备用地址 `http://192.168.31.60:3100`） |
| DEEPSEEK_API_KEY | 存在问题 | `Services/prompt-manager/.env.local` 中为占位符，容器内 AI 整理功能不可用；用户填入后需 `docker compose --env-file .env.local up -d` 重建容器 |
| Supabase Redirect URLs | 待用户操作 | 需在 Supabase Dashboard 的 URL Configuration 与 Google OAuth 中加入精确 `http://Mac-mini.local:3100`（项目接入智能体不得改 Dashboard） |
| 旧 dev server | 已停止 | watchdog / next dev 均未运行；3100 端口现由容器占用，**不要再运行 `./dev-server.sh start`（会端口冲突）** |
| 线上 Migration | 未变 | `20260901163555` 仍未发布；本轮无任何 `supabase db push`、Dashboard SQL 或生产数据库写操作 |

### PC 端接入与双设备验收指引

> **2026-09-02 12:45 更新**：PC 上代理软件（TUN/fake-IP）会劫持 `.local` 域名导致 `ERR_EMPTY_RESPONSE`/回跳失败，**统一改用裸 IP `http://192.168.31.60:3100` 访问**。Supabase Dashboard 已由用户修正：Site URL 从旧开发期残留的 `http://localhost:3100` 改为 `http://192.168.31.60:3100`（当时 redirect_to 不在白名单被静默回落到 localhost，PC 截图 `localhost:3100/?code=...` + ERR_CONNECTION_REFUSED 为确诊证据）。

验收清单（每项记录设备、时间、操作、两端结果）：

1. ✅ **已验证（2026-09-02 12:57，PC + MacBook Air）**：同一 Supabase 账号在 PC 与 MacBook Air 均通过 Google OAuth 登录成功（Chrome 浏览器，访问 `http://192.168.31.60:3100`；用户确认两台设备均已登录成功）。Dashboard 修正项：Site URL → `http://192.168.31.60:3100`，Redirect URLs 补 IP 与 Mac-mini.local 两条。
2. Mac 新建卡片 → PC 可见；PC 新建 → Mac 可见。
3. 双向编辑、双向删除。
4. 标签关系、版本历史、复制计数同步正确。
5. 两端同时编辑同一记录 → 出现明确冲突提示，不静默覆盖。
6. 断网 → 重连 → 刷新后从云端重新读取。
7. PC 使用自己独立的 MCP 令牌；撤销其中一枚不影响另一设备。

## 13. 备份与恢复演练完成（2026-09-02）

> 对生产库全程只读（`supabase db dump` 经 CLI 已存凭据，未接触数据库密码）；恢复在本地隔离 Docker 容器完成，未发布任何端口，演练后已删除。

### 13.1 备份来源与范围

| 文件（`/Users/zzymima0000/DockerBackups/prompt-manager/`） | 内容 | SHA-256（前 16 位） |
|---|---|---|
| `supabase-yacgnikzvutbpoqvokth-20260902-120451.sql`（22,004 B） | 全部结构：prompt_manager Schema、6 表、RLS 策略、GRANT、2 个 Function、索引、Realtime publication | `98ed0cb394d57cce` |
| `supabase-data-yacgnikzvutbpoqvokth-20260902-120817.sql`（148,650 B） | 全部数据：prompt_manager 6 表 + Supabase auth 6 表 | `1a03a119d7510a42` |
| `supabase-roles-20260902-120451.sql`（370 B） | 自定义角色配置（系统角色由平台建，不在 dump 内） | `168a95a9c745af5e` |
| `store.json.bak-20260902-115412` | 部署前旧 JSON 兜底数据快照 | `2557e4f9d4195744` |

导出时间 2026-09-02 12:04–12:09。备份文件含真实提示词正文与 auth 数据，存放于仓库外 DockerBackups 目录，**绝不进入 Git**；演练全程未在对话中输出任何正文、令牌或密钥。

### 13.2 恢复步骤（隔离环境）

1. `postgres:17-alpine` 容器（与云端 17.6 同大版本），不发布端口，仅 `docker exec` 访问。
2. 前置：补建 `anon/authenticated/service_role/authenticator` 角色（Supabase 平台角色不在 dump 中）、`extensions` schema、空 `supabase_realtime` publication。
3. auth schema 最小 stub：`scratch/restore-drill/gen_auth_stub.py` 从数据备份的 INSERT 头行解析列名生成（含 `refresh_tokens.id` bigint 序列；stub 不含任何数据值）。
4. 按序恢复：stub → 结构（过滤云端专有的 `supabase_vault` 扩展）→ 全量数据，全程 `ON_ERROR_STOP=1` 零错误。

### 13.3 恢复后验证结果（全部通过）

| 验证项 | 结果 |
|---|---|
| 行数 | cards 52 / card_versions 18 / tags 24 / prompt_tags 91 / settings 1 / mcp_access_tokens 1，与云端导入基线完全一致 |
| 外键孤儿 | prompt_tags→cards、prompt_tags→tags、tags父标签、card_versions→cards、cards→auth.users 全部 0 |
| RLS | 6 表全部启用；每表 4 条策略 |
| Function | `activate_prompt`（SECURITY DEFINER，已知 Advisor WARN 待审核人裁定）、`set_row_metadata`（invoker）均存在 |
| Realtime | publication 含 cards/card_versions/tags/prompt_tags/settings 共 5 表 |
| 敏感字段 | `settings` 中无 `aiApiKey`（0 行）；全程未输出 MCP 令牌、数据库密码、真实正文 |
| 调取码 | 6 个调取码全部唯一 |
| RPC 冒烟 | 随机令牌调用 `activate_prompt` 返回 0 行（拒绝行为正确） |

### 13.4 恢复副作用与回退方法

- **生产库副作用：无**（dump 为只读；演练容器独立，未发布端口，已 `docker rm -f` 删除）。
- 已知偏差（仅影响本地演练环境，不影响生产）：auth 为最小 stub；`supabase_vault` 扩展未装（业务表未使用）；本地不跑 Realtime（`wal_level` 警告可忽略）。
- 回退/重放方法：删除容器后按 13.2 步骤重跑；脚本与流程留存于 `scratch/restore-drill/`（不进 Git）。

## 14. AI 调用通用化改造（2026-09-02，用户需求）

用户要求 AI 服务不绑死 DeepSeek，可切换到任意厂商（当前目标：opencode Go 套餐）。

- **代码层**：`src/lib/ai.ts` `resolveAIConfig` 新增通用环境变量回退链——`AI_PROVIDER` / `AI_MODEL` / `AI_BASE_URL` / `AI_API_KEY`（旧 `DEEPSEEK_*` 降为兼容项，仅在通用变量未填时生效）。厂商抽象本身已支持 10 家（含 `opencode-go` 专属适配器，按模型自动选 chat/completions、messages、responses 三种端点）；设置界面本就支持切换厂商/模型/Key，无需改动。
- **部署层**：`docker/env.template` 与 `Services/prompt-manager/.env.local` 改为通用格式，当前默认指向 opencode Go（`AI_PROVIDER=opencode-go`，`AI_BASE_URL=https://opencode.ai/zen/go/v1`）；`AI_API_KEY` 已由用户填入 opencode Key（2026-09-02 12:33）。
- **生效与验证**：容器 `up -d` 重启后双路验证通过——① 容器内 Node 直连 `$AI_BASE_URL/chat/completions`（HTTP 200，模型回复正常）；② 应用自身 `/api/ai/summarize-thinking` 端到端返回真实 AI 摘要，确认 `resolveAIConfig` 正确走 `opencode-go` 适配器。
- 容器已重建重启（HTTP 200），`AI_*` 变量注入核验通过。设置界面填 Key 的路径（per-request header）不受影响，继续可用。
- 注意：`.env.local` 中 `NEXT_PUBLIC_*` 三项是构建期烧录，若将来改动需重建镜像。
- 备份保留策略：三份 Supabase SQL + JSON 快照均在 `DockerBackups/prompt-manager/`（仓库外，本机另一位置副本）。

## 15. 阶段暂停收束（2026-09-02 13:13，用户指示「开发先到这里暂时结束」）

> 本节是当前唯一有效的「下一步」入口；§8 的旧提示词已过时，以下面的 §15.4 为准。

### 15.1 当前工作进展（截至暂停时点）

| 事项 | 状态 |
|---|---|
| Docker 正式部署 | ✅ 完成（§12）：容器运行中、`0.0.0.0:3100`、legacy-store 挂载、HTTP 200 |
| 备份与恢复演练 | ✅ 完成（§13）：全绿验证，生产库零副作用 |
| AI 调用通用化 | ✅ 完成（§14）：`AI_*` 通用变量 + opencode Go 已验证走通（Key 已填） |
| 双设备登录 | ✅ 通过（§12 验收清单第 1 项）：PC + MacBook Air 均以同一 Supabase 账号 Google OAuth 登录成功；统一访问地址 **`http://192.168.31.60:3100`**；Dashboard Site URL 已修正 |
| **验收范围变更（2026-09-02 13:16，用户指示）** | PC 端**退出验收范围**（用户现只用 Mac Mini + MacBook Air，PC 暂不处理）。双设备验收重新定义为 **MacBook Air ↔ Mac Mini** 两端。⚠️ 注意：13:16「Air 修改/添加能同步到 Mini」实为**旧局域网链路**同步（当日云端零写入可证），并非云端同步——Air/Mini 需**云端登录态**下操作才算云端验收；13:18 Air 添加的卡即因未处云端会话而只进本地、后被整库覆盖，已于 13:3x 补传云端（详见 §15.5）。PC 不同步问题记入收口材料「存在问题」，不阻塞收口 |
| 双设备验收 2–7 项 | ⏳ **未开始**：双向增删改、标签/版本历史/复制计数、并发冲突提示、断网重连、MCP 独立令牌撤销 |
| 收口材料《共享 Supabase 数据库接入收口材料》 | ❌ 未生成：必须等验收 2–7 项全部通过 |
| Migration `20260901163555` | 🔒 未发布：只等共享 Supabase 数据库审核人，接入智能体不得发布/不得 `supabase db push` |

补充事实：旧 `data/store.json`、`/api/sync`、SSE 兼容链路全部保留未动；平台仓库（`平台丨共享 Supabase 数据库`）Migration 文件与 SHA 一致但仓库尚无任何 commit。

### 15.2 下一步任务（严格按序；验收范围为 MacBook Air ↔ Mac Mini，PC 已退出）

1. **双设备验收（Air ↔ Mini）剩余项**（两台设备均保持登录 `http://192.168.31.60:3100`，逐项记录设备/时间/结果）：
   - ✅ 已由用户实测：Air 新建/修改 → Mac Mini 同步可见（2026-09-02 13:16）
   - Mini 新建 → Air 可见（反向同步）
   - 双向删除（含影响数确认 + 10 秒撤销弹窗）
   - 标签关系、版本历史、复制计数
   - 两端同时编辑同一记录 → 明确冲突提示，不静默覆盖
   - 断网 → 重连 → 刷新后云端重新读取
   - Air 与 Mini 各自独立 MCP 令牌 + 撤销验证（撤销一枚不影响另一台）
   - 测试卡片统一带「测试」字样，验收后清理，不污染真实数据
2. **验收通过后**生成《共享 Supabase 数据库接入收口材料》：逐项标记 已验证 / 代码可见但未实际验证 / 待验证 / 存在问题（PC 端不同步列入「存在问题」），原样转交「共享 Supabase 数据库审核人」。
3. 每完成一个阶段更新本文件；验收结果不得把单机 HTTP 200、构建通过写成双设备验收通过。

### 15.5 数据事件复盘：本地抽屉卡片被整库覆盖 + 云端补传恢复（2026-09-02 13:3x）

- 经过：13:18 Air 新增「未命名提示词」写入 legacy store（第 53 张，id `2b0188a3`）；随后 legacy store.json 于 **13:32 被整库覆盖回 52 张**（文件大小 143,090 B 与 11:54 原始备份一致），该卡服务端/备份副本全部丢失，仅剩本会话记录中的完整正文。
- 教训：legacy `/api/sync` 链路存在**整库覆盖**行为（某台处于 legacy 模式的设备连上即可能以本地 52 张全集覆盖服务端）——**不得把 legacy-store/store.json 视为可靠备份**；其唯一可靠副本在 `DockerBackups/` 快照与各设备 localStorage（同样可能被覆盖）。这是遗留链路的已知风险，接续者勿在 legacy 上做任何"唯一副本"操作。
- 恢复：经用户授权，从会话记录重建正文（body 167 字符逐字一致，新 uuid `1fdc91aa-41aa-4f22-93e4-f0d0afef7c25`），通过 Supabase 管理 API（CLI 钥匙串令牌，`POST /v1/projects/{ref}/database/query`）以 owner `3e0acd69…` 补传云端 cards，保留原 created_at `2026-09-02T05:18:55.661Z`；验证 body_len=167。云端现 53 张。
- 写路径备忘：`supabase db query --project-ref` 需 --linked/db-url 不可用；可用钥匙串令牌 `security find-generic-password -s "Supabase CLI" -a supabase -w` + Management API `/database/query`（作为 postgres 执行，绕过 RLS——仅用于用户明确授权的数据补写，插入时显式带 owner_user_id）。
- 收尾复验（13:4x）：云端总数 cards 53 / versions 18 / tags 24 / rels 91（补传卡无版本/标签，其余与基线一致）；从白名单 IP `http://192.168.31.60:3100` 点击 Google 登录实测正常跳转 `accounts.google.com` 选号页——Mini 登录「没反应」确认为地址问题（`localhost` 不在白名单），改用 IP 即通。



### 15.3 注意事项与规矩（接续前必读）

1. **角色边界**：接续者角色是「项目接入智能体」，不是数据库审核人。不得自行宣布数据库已收口、不得发布 `20260901163555`、不得执行未经批准的 `supabase db push`、不得改 Supabase Dashboard、不得接入新的数据库功能。
2. **兼容链路保命线**：双设备验收 2–7 与恢复演练确认前，绝不删除或停用 `data/store.json`、`/api/sync`、SSE 兼容链路。
3. **运行时规矩**：3100 端口现由 Docker 容器占用，**禁止再运行 `./dev-server.sh start`**（端口冲突）；容器重启用 `cd /Users/zzymima0000/Services/prompt-manager && docker compose --env-file .env.local up -d`（普通 `AI_*` 变量重启即生效，无需重建镜像；改 `NEXT_PUBLIC_*` 才需 `--env-file .env.local build`）。
4. **访问地址定版**：统一用裸 IP `http://192.168.31.60:3100`——`.local` 域名会被设备上的代理软件（TUN/fake-IP）劫持，PC 端 `ERR_EMPTY_RESPONSE` 与 Air 回跳失败均源于此；LAN IP 变动时需同步改 Dashboard 的 Site URL/Redirect URLs。
5. **数据与安全**：`data/store.json` 只读不改；备份文件（含真实正文与 auth 数据）只放 `DockerBackups/prompt-manager/`，绝不进 Git；对话中不回显 aiApiKey、MCP 令牌、数据库密码、真实提示词正文；`.env.local`（600 权限）不提交。
6. **「本地抽屉 vs 云端抽屉」数据模式（2026-09-02 13:2x 实测确诊，接续者必读）**：应用存在两套数据源且**不会自动互通**——`cloudMode=true`（云端登录会话有效且云端有数据）时只显示/写入云端 52 张卡；未登录时走旧局域网链路（服务端 `legacy-store/store.json` + `/api/sync` + SSE + 各浏览器 localStorage）。**未登录状态下新增/修改只进本地抽屉，绝不会自动上传云端**；反之登录后页面只显示云端数据，本地抽屉里未上传的卡在界面上「看不见」但并未丢失（存于服务端 store.json / localStorage / DockerBackups 备份）。2026-09-02 13:18 Air 新增的「未命名提示词」（id `2b0188a3`，内容为用户 13:13 的消息文本）即为此情形：云端 52 张完好（与 12:09 基线逐 id 一致），该卡安全存在于 legacy store（第 53 张）。排查手法：只读 dump 云端 `supabase db dump --data-only` → 与 store.json 按 id 集合 diff。
7. **登录必须用白名单地址**：任何设备（含 Mac Mini 本机）都打开 `http://192.168.31.60:3100` + Chrome；**不要用 `localhost:3100`/`127.0.0.1:3100`**——不在 Supabase Redirect URLs 白名单，Google 登录回跳会被 Supabase 静默改送到 Site URL，产生「点了没反应/跳回/登录后看不到数据」的错觉（已实测 localhost 点击会正常跳 Google，问题出在回跳落点跨 origin）。
8. **Git**：未经用户明确授权不 commit / 不 push（当前 `bb32e42` 已提交、未 push）。
7. **服务端配置已验证项不要重复折腾**：Supabase authorize 对 IP/`.local` 两种回跳均 302 接受；恢复演练脚本在 `scratch/restore-drill/`（含踩坑记录：PRIMARY KEY 括号位置、`refresh_tokens.id` bigint、`supabase_vault` 过滤、`supabase_realtime` publication 预建）。
8. 其他项目全局规矩见根目录 `AGENTS.md`；文档归属、角色权限、临时文件规范以 `AGENTS.md` 为准。

### 15.4 下一个智能体接续恢复提示词（一键复制）

```text
请恢复提示词管理器的 Supabase 云端多端同步收口工作。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

开始前必须完整阅读：
1. AGENTS.md
2. docs/handoff/HANDOFF.md（重点 §12–§15，§15 是当前唯一有效的进展与下一步入口）
3. docs/pm/PLAN.md
4. 2026-09-02 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.1.md

你的角色是「项目接入智能体」，不是「共享 Supabase 数据库审核人」。

当前状态（详见 HANDOFF §15.1，不要重复折腾已验证项）：
- Docker 正式部署 ✅（容器占用 3100 端口，禁止运行 ./dev-server.sh start；重启命令见 §15.3）
- 备份与恢复演练 ✅（全绿，脚本在 scratch/restore-drill/）
- AI 调用已通用化并切到 opencode Go ✅（Key 已填，端到端验证通过）
- 双设备登录 ✅（PC + MacBook Air 均以同一 Supabase 账号登录成功，统一访问 http://192.168.31.60:3100，不要用 .local 域名——会被代理 TUN 劫持）
- Supabase 线上项目 yacgnikzvutbpoqvokth；Migration 20260901152616、20260901152750 已上线，20260901163555 未发布
- 旧 JSON、/api/sync、SSE 兼容链路全部保留

后续严格按顺序执行（验收范围为 MacBook Air ↔ Mac Mini 两端；PC 已按用户 2026-09-02 13:16 指示退出验收范围，PC 不同步问题仅记入收口材料「存在问题」）：
1. 指导用户完成双设备验收剩余项（HANDOFF §15.2）：Mini→Air 反向同步、双向删除、标签关系、版本历史、复制计数、同一记录并发编辑的冲突提示、断网重连后云端重读、每台设备独立 MCP 令牌及撤销验证。逐项记录设备、时间、操作与两端结果；测试卡片统一带「测试」字样，验收后清理。不得把单机 HTTP 200、构建通过或静态检查写成双设备验收通过。
2. 验收 2–7 项全部通过后，生成《共享 Supabase 数据库接入收口材料》，逐项标记：已验证 / 代码可见但未实际验证 / 待验证 / 存在问题，并将完整材料原样转交「共享 Supabase 数据库审核人」。
3. 每完成一个阶段更新 docs/handoff/HANDOFF.md。

硬性禁区：
- 不得自行宣布数据库已收口，不得发布 20260901163555 Migration，不得执行未经批准的 supabase db push，不得修改 Supabase Dashboard，不得继续接入新的数据库功能。
- 双设备验收与收口材料通过前，绝不删除或停用 data/store.json、/api/sync、SSE 兼容链路。
- 没有用户明确授权，不要 commit、push、启动新容器、创建新生产目录。
- 对话中不得泄露 aiApiKey、MCP 原始令牌、数据库密码或真实提示词正文。
```

## 16. 阶段二次收束（2026-09-02 13:40，用户指示「继续完成收尾，开发先到这里暂时结束」）

> 本节是当前**唯一有效**的「下一步」入口，取代 §15.4 旧提示词。相对 §15 的新增事实：**Mac Mini 已于 13:37 云端登录成功**，双设备（Air ↔ Mini）云端验收的前置条件全部就绪。

### 16.1 当前工作进展（截至 13:40 收尾时点）

| 事项 | 状态 | 说明 |
|---|---|---|
| Docker 正式部署 | ✅ | §12：容器 Up、`0.0.0.0:3100`、legacy-store 挂载、HTTP 200 |
| 备份与恢复演练 | ✅ | §13：全绿，生产零副作用；脚本 `scratch/restore-drill/` |
| AI 调用通用化 | ✅ | §14：`AI_*` 通用变量 + opencode Go 端到端通过（Key 已填） |
| 云端数据完整性 | ✅ | 13:39 复核：cards 53 / versions 18 / tags 24 / prompt_tags 91 / settings 1 / mcp_access_tokens 1；补传卡 `1fdc91aa-41aa-4f22-93e4-f0d0afef7c25`（title「未命名提示词」，body 167 B）在云端 |
| MacBook Air 云端登录 | ✅ | 12:57 Google OAuth 登录成功 |
| **Mac Mini 云端登录** | ✅ | **13:37 用户实测成功**：打开 `http://192.168.31.60:3100` → Google 登录跳转正常；「没反应」根因 = 之前用 `localhost:3100`（不在白名单） |
| Mini 云端读取验收 | ✅ | 本轮用户实测：Mini 云端登录态刷新后可见 53 张卡，且可找到 Air 补传的「未命名提示词」；云端读取链路已验收 |
| 双设备云端验收 2–7 项 | ⏳ | Air↔Mini 增删改 / 标签 / 版本 / 计数 / 并发冲突 / 断网 / MCP 令牌——**尚未开始**（登录与 Mini 读取前置已齐） |
| 收口材料 | ❌ | 待验收全过后生成 |
| Migration `20260901163555` | 🔒 | 未发布，只等共享 Supabase 数据库审核人 |

补充：
- ⚠️ 13:16 用户实测的「Air 修改/添加 → Mini 可见」走的是**旧局域网链路**（当日云端零写入可证），**不算云端验收**；云端验收必须两端处于云端登录态且云端可见写入。
- PC 已按用户 13:16 指示退出验收范围，其不同步问题仅记入收口材料「存在问题」，不阻塞收口。

### 16.2 下一步任务（严格按序）

1. **Mini 云端读取验收**：请用户在 Mini（已登录态）刷新页面，确认可见 **53 张**卡，含 Air 补传的「未命名提示词」（body 167 字符）。
2. **双设备云端验收（Air ↔ Mini）**——两台设备都打开 `http://192.168.31.60:3100` 并保持 Google 登录态，逐项记录设备 / 时间 / 操作 / 两端结果：
   - Air 新建「测试」卡 → Mini 实时可见；Mini 新建 → Air 实时可见（双向新建）
   - 双向编辑（另一端可见内容变化、版本历史 +1）
   - 双向删除（影响数确认弹窗 + 10 秒撤销）
   - 标签关系、复制计数同步
   - 两端**同时编辑同一记录** → 明确冲突提示，不静默覆盖
   - 断网 → 重连 → 刷新后云端重读
   - Air 与 Mini **各自独立 MCP 令牌**；撤销其中一枚不影响另一台
   - 测试卡统一带「测试」字样，验收后清理，不污染真实数据
3. 全部通过后生成《共享 Supabase 数据库接入收口材料》（逐项标记：已验证 / 代码可见但未实际验证 / 待验证 / 存在问题），原样转交「共享 Supabase 数据库审核人」。
4. 每完成一个阶段更新本文件（§16 后续小节）。

### 16.3 注意事项与规矩（接续前必读）

> 沿用 §15.3 全部条目，以下为增补 / 强调：

1. **角色边界**：接续者 = 项目接入智能体，非审核人。不得自行宣布数据库已收口、不得发布 `20260901163555`、不得执行未经批准的 `supabase db push`、不得改 Supabase Dashboard、不得继续接入新的数据库功能。
2. **兼容链路保命线**：验收 2–7 项与收口材料通过前，绝不删除或停用 `data/store.json`、`/api/sync`、SSE 兼容链路。
3. **运行时**：3100 端口已被 Docker 容器占用，**禁止 `./dev-server.sh start`**；容器重启用 `cd /Users/zzymima0000/Services/prompt-manager && docker compose --env-file .env.local up -d`（改 `NEXT_PUBLIC_*` 才需 `--env-file .env.local build`）。
4. **访问地址定版**：**只用 `http://192.168.31.60:3100`**（含 Mac Mini 本机）；`localhost`/`127.0.0.1` 不在 Supabase Redirect 白名单（回跳会被改送 Site URL 产生「登录没反应」），`.local` 会被代理 TUN 劫持。LAN IP 变动需同步改 Dashboard Site URL / Redirect URLs。
5. **双数据源不互通**：未登录操作只进本地抽屉、绝不自动上云；登录后界面只显示云端数据。排查用只读 dump 与 store.json 按 id 集合 diff。
6. **数据与安全**：`data/store.json` 只读不改；备份（含真实正文与 auth 数据）只放 `DockerBackups/prompt-manager/` 绝不进 Git；对话 / 文档不回显 aiApiKey、MCP 令牌、数据库密码、真实提示词正文；`.env.local`（600）不提交。
7. **Git**：无用户明确授权不 commit / 不 push（当前 `bb32e42` 已 commit、未 push）。
8. **写库备忘（仅限用户明确授权的数据补写）**：CLI 钥匙串令牌（`security find-generic-password -s "Supabase CLI" -a supabase -w`）+ Management API `POST /v1/projects/{ref}/database/query`（postgres 执行、绕过 RLS，插入须显式带 `owner_user_id`）。
9. 其他项目全局规矩见根目录 `AGENTS.md`。

### 16.4 下一个智能体接续恢复提示词（一键复制，须在对话窗口直接交给下一智能体）

```text
【继续 Prompt Manager Supabase 收口】
你现在是「项目接入智能体」（不是共享 Supabase 数据库审核人），继续完成提示词管理器的 Supabase 云端多端同步收口工作。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

动手前先完整阅读（按顺序）：
1. AGENTS.md
2. docs/handoff/HANDOFF.md —— 重点 §12–§16，§16 是当前唯一有效入口
3. docs/pm/PLAN.md
4. 2026-09-02 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.1.md

当前已完成现状（HANDOFF §16.1，已验证项不要重复折腾）：
- Docker 正式部署 ✅：容器 prompt-manager-prompt-manager-1 占用 0.0.0.0:3100。禁止运行 ./dev-server.sh start（端口冲突）；重启容器：cd /Users/zzymima0000/Services/prompt-manager && docker compose --env-file .env.local up -d
- 备份与恢复演练 ✅ 全绿（脚本 scratch/restore-drill/；备份在 DockerBackups/prompt-manager/，不进 Git）
- AI 调用通用化 ✅：AI_PROVIDER/AI_MODEL/AI_BASE_URL/AI_API_KEY + opencode Go，Key 已填、端到端验证通过
- 云端数据 ✅：cards 53 / versions 18 / tags 24 / prompt_tags 91 / settings 1 / mcp_access_tokens 1
- 双设备云端登录 ✅：MacBook Air（12:57）与 Mac Mini（13:37 用户实测）均已 Google 登录成功。统一访问 http://192.168.31.60:3100 —— 不要用 localhost（不在白名单）也不要用 .local（被代理 TUN 劫持）
- Supabase 线上项目 yacgnikzvutbpoqvokth；Migration 20260901152616 / 20260901152750 已上线；20260901163555 未发布
- data/store.json、/api/sync、SSE 兼容链路全部保留未动

接下来严格按顺序执行（验收范围 = MacBook Air ↔ Mac Mini 两端；PC 已按用户指示退出验收范围，其不同步问题仅记入收口材料「存在问题」，不阻塞收口）：

1. 请用户在 Mac Mini（云端登录态）刷新页面，确认可见 53 张卡，含 Air 补传的「未命名提示词」（body 167 字符，uuid 1fdc91aa-41aa-4f22-93e4-f0d0afef7c25）。这是 Mini 云端读取链路验收。
2. 双设备云端验收（两台都打开 http://192.168.31.60:3100 并保持登录态；详见 HANDOFF §16.2）：
   - 双向新建：Air 新建「测试」卡 → Mini 实时可见；Mini 新建 → Air 实时可见
   - 双向编辑：另一端可见内容变化、版本历史 +1
   - 双向删除：影响数确认 + 10 秒撤销
   - 标签关系、复制计数同步
   - 两端同时编辑同一记录 → 明确冲突提示，不得静默覆盖
   - 断网 → 重连 → 刷新后云端重读
   - Air 与 Mini 各自独立 MCP 令牌；撤销其中一枚不影响另一台
   逐项记录设备、时间、操作与两端结果；测试卡统一带「测试」字样，验收后清理。不得把单机 HTTP 200、构建通过或静态检查写成双设备验收通过。
3. 第 2 步全部通过后，生成《共享 Supabase 数据库接入收口材料》（逐项标记：已验证 / 代码可见但未实际验证 / 待验证 / 存在问题；不得输出 aiApiKey、MCP 原始令牌、数据库密码或真实提示词正文），将完整材料原样转交「共享 Supabase 数据库审核人」，不得只交摘要。
4. 每完成一个阶段更新 docs/handoff/HANDOFF.md。

硬性禁区：
- 你是项目接入智能体，不是审核人：不得自行宣布数据库已收口，不得发布 20260901163555 Migration，不得执行未经批准的 supabase db push，不得修改 Supabase Dashboard，不得继续接入新的数据库功能。
- 双设备验收与收口材料通过前，绝不删除或停用 data/store.json、/api/sync、SSE 兼容链路。
- 没有用户明确授权，不要 commit、push、启动新容器、创建新生产目录。
- 对话与文档中不得泄露 aiApiKey、MCP 原始令牌、数据库密码或真实提示词正文。
```

### 16.5 Mini 云端读取验收记录（本轮）

| 项目 | 结果 |
|---|---|
| 验收范围 | Mac Mini，Google 云端登录态，访问固定 LAN 地址 |
| 操作 | 用户刷新页面并核对云端卡片总数与 Air 补传卡标题 |
| Mini 结果 | ✅ 可见 53 张卡；可找到「未命名提示词」 |
| 结论 | ✅ Mini 已从 Supabase 云端读取到当前完整数据；进入 Air ↔ Mini 双向验收 |

后续验收仍须逐项记录真实双设备操作与两端结果；单机页面结果不得替代双设备验收。

### 16.6 Air ↔ Mini 协助式 QA 双设备验收记录（2026-09-02）

> 本记录依据用户在 MacBook Air 与 Mac Mini 的真实操作反馈；用户未提供具体分钟或截图，因此不虚构时间和截图证据。未记录真实提示词正文、MCP 原始令牌、AI API Key 或数据库密码。

| 验收项 | 状态 | 事实记录 |
|---|---|---|
| 双向新建 | ✅ 通过 | Air → Mini、Mini → Air 均约 3 秒内实时可见，无需刷新；测试卡名称含「测试」 |
| 双向编辑与版本 | ✅ 通过 | 两方向编辑均约 3 秒内同步；用户确认对应版本历史均增加 |
| 双向删除与撤销 | ✅ 通过 | 出现影响数确认；10 秒内撤销；Mini 看到恢复；最终删除后同步消失，用户报告约 1 秒级 |
| 标签关系与复制计数 | ✅ 通过 | `测试-云端标签` 关系在另一端可见；复制次数准确增加 1，无需刷新 |
| 并发冲突 | ⏳ 待验证 | Air 自动保存后 Mini 立即收到更新，未能形成 Mini 提交旧版本的测试条件；未观察到冲突提示，不能判定通过 |
| 断网、重连与云端重读 | ✅ 通过 | 用户报告断网、恢复网络、刷新后验收通过；具体页面提示/截图未提供 |
| MCP 令牌隔离 | ❌ 失败 | Air 点击生成令牌出现 `crypto.randomUUID is not a function`；双令牌创建、单独撤销及另一端继续使用均未完成 |
| 清理 | ✅ 通过 | 用户确认两端刷新后测试卡与测试标签均已清理，真实云端数据未受影响 |

#### 本轮后续记录

1. 保留上述状态，不把第 5、7 项写成通过；第 7 项对应 `docs/qa/BUGS.md` 的 BUG-9。
2. 并发冲突仍需在可控的旧版本提交条件下重新验收，重点确认不得静默覆盖。
3. MCP 令牌生成问题修复后，重新完成 Air/Mini 独立令牌、仅撤销 Air、Mini 仍可用的真实验收。
4. 在第 5、7 项完成前，不生成“已收口/已批准”结论，不发布 Migration `20260901163555`，不执行 `supabase db push`，继续保留 `data/store.json`、`/api/sync` 与 SSE 兼容链路。

### 16.7 BUG-9 源码修复、部署与复测前状态（2026-09-02）

| 项目 | 状态 | 说明 |
|---|---|---|
| 根因定位 | ✅ | 固定 HTTP IP 地址不是浏览器安全上下文；客户端 `crypto.randomUUID()` 与 `crypto.subtle` 不能作为 MCP 凭据生成依赖 |
| 源码修复 | ✅ | 新增同源 Route Handler：Node `randomBytes(32)` 生成一次性令牌、SHA-256 哈希；Auth `getUser(jwt)` 校验后使用该用户 JWT 受既有 RLS 写入；浏览器不再生成或哈希令牌 |
| 安全边界 | ✅（代码） | 不使用 `service_role`，不新增 Supabase 表、Function、Schema、Migration 或 Dashboard 配置；响应 `no-store`，令牌只返回一次 |
| 开发构建 | ✅ | TypeScript、修复文件 ESLint、Webpack 生产构建、MCP 子包构建均通过；默认 Turbopack 的 `.next/server` 占用错误不等同代码错误 |
| 正式部署 | ✅ | 用户授权后仅同步两处修复源码至既有 Services 副本，重建并重启现有容器；无 Supabase 数据库变更 |
| 运行时健康检查 | ✅（非端到端） | 容器 Up、`0.0.0.0:3100`；首页 200；未带登录凭据的 `POST /api/mcp-access-tokens` 返回预期 401 |
| MCP 令牌复制兼容 | ✅（Air 真机已验证） | Air 发现 HTTP 下 Clipboard API 被拒绝；已增加用户点击触发的选区复制兜底并重建现有容器。Air 已真实复制并粘贴验证成功；Mini 将随令牌隔离复测 |
| Air ↔ Mini MCP 隔离复测 | ⏳ | 待正式部署后，真实验证两台各自生成令牌、撤销 Air 一枚后 Mini 仍可用；不得记录令牌原文 |
| 并发冲突复测 | ⏳ | 仍须构造旧版本提交条件，确认不得静默覆盖 |

本阶段没有改动 Supabase 线上数据库、Dashboard、Migration `20260901163555` 或旧 JSON / `/api/sync` / SSE 兼容链路。项目接入智能体不得据此宣布收口。

### 16.8 当前唯一下一步（2026-09-02）

仅剩两项**真实双设备**验收，均须在 Air 与 Mini 保持 Google 登录、使用 `http://192.168.31.60:3100` 的正式容器时完成：

1. **MCP 令牌隔离复测**：Air 先创建令牌并点击复制，粘贴到本机纯文本编辑器确认成功（不回传令牌原文）；Air 与 Mini 分别创建一枚令牌；仅撤销 Air 的令牌；确认 Mini 的令牌仍可调用。
2. **并发冲突复测**：以可控方式保留 Mini 的旧编辑版本，在 Air 先保存后再尝试提交 Mini 的旧版本；必须出现明确冲突处理，不得静默覆盖。

完成后，由 QA 在 `docs/qa/BUGS.md` 更新两项真实结果，再由项目接入智能体生成完整《共享 Supabase 数据库接入收口材料》并原样转交共享 Supabase 数据库审核人。此之前：不得宣布收口、不得发布 `20260901163555`、不得执行 `supabase db push`，兼容链路继续保留。

### 16.9 当前唯一交接（2026-09-02，本节为当前唯一有效入口）

> 用户指示「开发先到这里暂时结束」。接续者必须以本节为准；§16.4 的旧恢复提示和 §16.8 的旧任务摘要只作历史记录，不得跳过本节直接继续。

#### 当前工作进展

| 事项 | 状态 | 已有证据 / 边界 |
|---|---|---|
| Supabase 云端主数据与登录 | ✅ 已验证 | 项目 `yacgnikzvutbpoqvokth`；Air、Mini 都已 Google 登录；Mini 云端刷新可见 53 张卡及补传卡 |
| 当前运行策略 | ✅ Mini 单设备运行 | 用户决定暂时只在 Mini 的已登录云端页面使用；这降低跨端竞态风险，但不等于多端验收或数据库收口 |
| Air ↔ Mini 云端 CRUD | ✅ 已验证 | 双向新建、编辑与版本、删除与撤销、标签与复制计数、断网重读均由协助式 QA 真实记录；测试数据已清理 |
| 并发冲突 | ⏳ 待真实验证 | Realtime 更新过快，未形成旧版本提交条件；尚未看到冲突提示，绝不能标通过 |
| MCP 令牌生成（BUG-9） | ✅ Air 真机通过 | 浏览器端 Web Crypto 改为服务端 Node 随机令牌 + SHA-256；Auth `getUser(jwt)` 校验后按用户 JWT/RLS 写入，无 `service_role`、无数据库结构变更；Mini 未复测 |
| MCP 令牌复制（BUG-10） | ✅ Air 真机通过 | 固定 HTTP IP 下 Clipboard API 受限；已增加用户点击触发的选区复制兜底，Air 已创建、复制、粘贴确认成功；Mini 未复测 |
| Mini 本地 MCP 接入 | ⏸️ 暂缓（BUG-11） | 设置页显示 Mini 令牌在失败调用后已有“上次使用”时间，故令牌已获云端认可。竞态修复虽已部署，但用户报告两端新测试卡均丢失；本轮按用户指示不继续排障。两端是否加载了新前端尚未确认，故不得标记修复有效，详见 BUG-11 |
| MCP 双设备隔离 | ⏸️ 暂缓 | 依赖 BUG-11 的卡片持久化验收；不得把未完成的 MCP 调取或单独撤销闭环写成通过 |
| Docker 正式运行时 | ✅ 运行中 | `prompt-manager-prompt-manager-1` 绑定 `0.0.0.0:3100`；最新容器构建通过、首页 HTTP 200；新令牌接口未登录返回预期 401（不是端到端认证证明） |
| 备份与恢复演练 | ✅ 已完成 | §13 全绿；备份仅在 `DockerBackups/prompt-manager/`，不进 Git |
| 兼容链路 | 🔒 保留 | `data/store.json`、`/api/sync`、SSE 未删除、未停用；legacy 存在整快照覆盖风险，不能作为唯一副本 |
| Migration `20260901163555` | 🔒 未发布 | 接入智能体不得发布；等待共享 Supabase 数据库审核人裁定 |
| 开发工作树 | ⚠️ 未提交 | 当前有未提交/未跟踪改动（含 MCP 修复、Docker/AI 相关既有改动与 `supabase/` 临时目录）；不得覆盖、重置、删除或擅自 commit/push |

#### 当前运行与恢复任务（Mini 单设备模式）

1. **单设备安全使用**：Mini 只通过已登录的云端地址使用；重要新卡等待写入完成后刷新确认，再定期导出。不得重新启用另一台旧客户端、旧 JSON 或脚本来对该数据集写入。
2. **并发冲突验收暂缓**：它需要第二个独立会话（原计划 Air）。只用 Mini 时不做伪造的“多端通过”结论；恢复多设备使用前，先完成此项真实验收。
3. **BUG-11 恢复排障时再验收**：先硬刷新所有参与设备；Mini 新建无敏感测试卡；另一端触发一次真实云端变更；Mini 卡片不得消失，刷新后仍在；再由 Mini MCP 调取该卡。硬刷新后的新尝试仍失败则停止重试、抓取浏览器实际保存错误；不得改用旧 JSON 链路掩盖。
4. **MCP 双设备隔离暂缓**：仅在 BUG-11 通过且用户恢复 Air 等第二设备后，才配置 Air 本地令牌、完成两端实际调取，并验证撤销 Air 令牌不影响 Mini。
5. QA 只可按实际结果更新 BUGS；BUG-11、MCP 双设备隔离、并发冲突未通过前，项目接入智能体不得生成收口材料、不得申请或自行宣布数据库收口。

#### 规范迭代（已完成 V1.2；不改变收口门禁）

- 用户已授权基于本次真实部署、兼容链路与 BUG-11 经验升级规范。数据库当前生效文件为 `2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md`；V1.0/V1.1 均保留为历史记录。
- Docker 当前生效文件为 `2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md`。两份规范按“数据库 / Runtime”分工，不重复维护；均不改变 Supabase 数据库、权限、Migration、容器或旧兼容链路，也不得借此绕过 BUG-11、并发冲突、MCP 隔离或审核人放行门禁。

#### 注意事项与相关规矩

1. **访问地址固定**：Air 与 Mini 只用 `http://192.168.31.60:3100`；不要用 `localhost`、`127.0.0.1` 或 `.local`。局域网 IP 变化时，先停下并由用户决定是否调整 Auth 白名单。
2. **角色与线上禁区**：接续者是项目接入智能体，不是审核人；不得改 Dashboard、发布 `20260901163555`、执行 `supabase db push`、接入新数据库功能或自行宣布收口。
3. **运行时禁区**：3100 已由 Docker 容器占用，绝不运行 `./dev-server.sh start`。用户明确授权后，才可在 `/Users/zzymima0000/Services/prompt-manager` 用 `docker compose --env-file .env.local up -d --build` 重建既有容器。
4. **部署边界**：日常源码只改开发目录；Services 不是开发目录。没有用户授权，不向 Services 写入、不开新生产目录、不动 DockerData / DockerBackups / Named Volume。正式部署前应先取得 Git 提交授权；本轮此前获用户部署授权但未获 commit/push 授权，故源码仍未提交。
5. **数据与密钥**：不得展示或记录 AI API Key、MCP 原始令牌、数据库密码、Auth token、真实提示词正文或包含这些值的截图。`.env.local` 仅存各自本机且不得进 Git；令牌生成后只显示一次，未保存的令牌应撤销。
6. **验证口径**：Docker 构建、HTTP 200、401、Lint、TypeScript 均不是双设备验收。只接受用户在 Air ↔ Mini 实际操作后的记录；PC 已退出验收范围，其问题仅在收口材料列为“存在问题”。
7. **本地构建提示**：开发目录默认 Turbopack 构建曾因共享 `.next/server` 的 `ENOTEMPTY` 失败；不得删除 `.next` 或停其他进程强行处理。修复相关 TypeScript / 专用 Lint 均通过，Docker 隔离生产构建完整通过。
8. **旧链路保命线**：直至审核人明确批准，绝不删除或停用 `data/store.json`、`/api/sync`、SSE；未登录操作只进入本地抽屉，不会自动上传云端。

#### 下一个智能体恢复提示词（复制本段即可）

```text
【继续 Prompt Manager Supabase 收口】
你现在是「项目接入智能体」，不是「共享 Supabase 数据库审核人」。请继续提示词管理器的 Supabase 云端多端同步收口工作。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

开始前按顺序完整阅读：
1. AGENTS.md
2. docs/handoff/HANDOFF.md —— 重点阅读 §12–§16，且 **§16.9 是当前唯一有效入口**
3. docs/pm/PLAN.md
4. 2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md
5. 2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md
6. docs/qa/BUGS.md —— 重点 BUG-9、BUG-10、BUG-11 与 Air ↔ Mini 协助式 QA 记录

当前已完成，禁止重复折腾：
- Docker 正式容器 `prompt-manager-prompt-manager-1` 已运行并绑定 `0.0.0.0:3100`；禁止 `./dev-server.sh start`。
- 备份与恢复演练全绿；AI 调用通用化已验证；云端数据基线为 cards 53 / versions 18 / tags 24 / prompt_tags 91 / settings 1 / mcp_access_tokens 1。
- Air、Mini 都已通过 Google 登录；统一只访问 `http://192.168.31.60:3100`，不要用 localhost / 127.0.0.1 / .local。
- Mini 云端读取、Air ↔ Mini 双向 CRUD、版本、删除撤销、标签、复制计数、断网重读均已真实验证；测试数据已清理。
- BUG-9 已修复并部署：MCP 令牌在服务端生成与 SHA-256 哈希，使用 Auth `getUser(jwt)` + 既有 RLS，不使用 service_role；Air 已真实创建成功；未改 Supabase 数据库结构。
- BUG-10 已修复并部署：固定 HTTP IP 下的令牌复制有选区复制兜底；Air 已真实复制粘贴成功。
- Mini 已完成本地 Codex MCP 配置写入，原配置已自动备份，stdio 握手与工具注册已通过；Mini 令牌也已由云端“上次使用”记录确认有效。发现本机卡片尚未落云时会被 Realtime 旧快照覆盖的竞态，修复已部署到既有 Docker 容器；用户要求暂不继续排障，见 BUG-11。
- `data/store.json`、`/api/sync`、SSE 兼容链路全部保留未动；Migration `20260901163555` 未发布。

历史收口顺序（**暂不执行**；当前以 §16.9 的「Mini 单设备模式」和本段上方的当前任务为准）：
1. 先完成不依赖 BUG-11 的并发冲突真实验收：Mini 保留旧编辑、Air 先保存、Mini 再提交旧编辑；必须确认有明确冲突处理、没有静默覆盖。
2. BUG-11 目前是用户指定的暂缓项。恢复排障时，先硬刷新 Air 与 Mini，再完整执行“Mini 新建无敏感卡 → Air 制造云端变更 → Mini 卡不消失 → Mini 刷新后仍在 → Mini MCP 调取”的验收；若失败，抓取浏览器保存错误，不得猜测或以旧 JSON 掩盖。
3. 仅在 BUG-11 通过后，Air 才配置自己的本地 MCP 令牌、两端实际调取同一卡、撤销 Air 令牌后证明 Mini 仍可调取。
4. 所有真实结果由 QA 更新 BUGS；只有 BUG-11、MCP 隔离、并发冲突均通过，才能生成完整《共享 Supabase 数据库接入收口材料》并原样转交共享 Supabase 数据库审核人。

数据库规范已升级为 V1.2；后续恢复第二设备前，仍不得以文档更新替代 BUG-11、并发冲突、MCP 隔离或审核人放行。

硬性禁区：
- 不得自行宣布数据库已经收口，不得批准发布，不得发布 `20260901163555`，不得执行 `supabase db push`，不得改 Supabase Dashboard，不得接入新数据库功能。
- 未经用户明确授权，不得 commit、push、更新 Services、重建容器、创建生产目录或改 DockerData / DockerBackups / Named Volume。
- 不得删除/停用 `data/store.json`、`/api/sync`、SSE。
- 不得泄露 AI API Key、MCP 原始令牌、数据库密码、Auth token 或真实提示词正文。
- 工作树有未提交/未跟踪改动；先检查 `git status`，绝不 reset、checkout、覆盖或删除用户已有改动。
```

### 16.11 收口材料生成记录（2026-09-02，应用户要求提前生成）

- 用户在知悉 BUG-11 / 并发冲突 / MCP 双设备隔离均暂缓的情况下，明确要求提前生成收口材料并转交审核人。
- 材料唯一载体：`docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`（本节仅为指针，不重复维护正文）。它是一次性审核提交材料，不是规范；规范仍以数据库 V1.2 与 Docker V1.0 为准。
- 材料按 §8 规范逐项标记「已验证 / 代码可见但未实际验证 / 待验证 / 存在问题」，暂缓项一律如实标注，不写成通过；未输出任何密钥、令牌或真实正文。
- 材料自评结论为「请求审核人裁定（预期 `CHANGES_REQUIRED` 或 `BLOCKED`）」；接入智能体未自行宣布收口，未发布 Migration，未执行 `supabase db push`，未改 Dashboard，未动兼容链路与 Git 状态。
- §16.10 门禁不变：即使审核人放行，BUG-11、并发冲突、MCP 隔离的真实双设备验收仍须按原顺序补齐。

## 16.12 阶段三次收束（2026-09-02，用户指示「开发先到这里暂时结束」；当前唯一有效入口）

> 本节取代 §16.10 / §16.11 成为当前唯一有效入口；更早小节仅作历史记录。

### 1. 当前工作进展

| 事项 | 状态 | 已验证事实 / 边界 |
|---|---|---|
| 数据库 / Docker 规范 | ✅ 已生效 | 数据库 V1.2 + Docker V1.0；V1.0/V1.1 数据库规范仅作历史 |
| 收口材料 | ✅ 已生成（提前） | 唯一载体：`docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`；应用户要求在 BUG-11 等暂缓项未验收的情况下提前生成，逐项如实标注「已验证/代码可见但未实际验证/待验证/存在问题」；自评预期审核结果 `CHANGES_REQUIRED` 或 `BLOCKED`；**待用户原样转交审核人** |
| 审核裁定 | ⏳ 未发生 | 审核人尚未给出 `APPROVED_FOR_EXECUTION` / `CHANGES_REQUIRED` / `BLOCKED`；接入智能体不得自行宣布收口 |
| Supabase 云端 | ✅ 运行 | 项目 `yacgnikzvutbpoqvokth`；Mini 已登录读取 53 张卡；登录后云端为主数据源 |
| 当前使用方式 | ✅ Mini 单设备 | 只用 `http://192.168.31.60:3100` 已登录页面；重要新增保存后刷新确认并定期导出 |
| Docker Runtime | ✅ 运行中 | `prompt-manager-prompt-manager-1` 占 3100；禁止 `./dev-server.sh start` |
| 备份与恢复 | ✅ 演练全绿 | 备份在 `DockerBackups/prompt-manager/`；不进 Git |
| BUG-9 / BUG-10 | ✅ Air 真机通过 | Mini 复测随令牌隔离验收执行 |
| BUG-11 | ⏸️ 暂缓 | 修复代码已部署未验证；不得标为已修复 |
| 并发冲突 / MCP 双设备隔离 | ⏸️ 暂缓 | 未验收，不得写成通过 |
| Migration `20260901163555` | 🔒 未发布 | 不得 `supabase db push`、不得改 Dashboard；发布由审核人流程决定 |
| 兼容链路 | 🔒 保留 | `data/store.json`、`/api/sync`、SSE 未删未停 |
| Git 工作树 | ⚠️ 未提交 | master 领先 origin 1 提交；另有未提交修改（MCP/AI/文档）与未跟踪项（`supabase/`、`src/app/api/mcp-access-tokens/`、两份规范、收口材料文件）；不得 reset/checkout/覆盖/删除/commit/push，除非用户明确授权 |

### 2. 下一步任务（严格按序）

1. **用户转交收口材料**：把 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 原样交给共享 Supabase 数据库审核人（同机智能体可直接给文件路径；跨机/给人则发文件或粘贴全文，不得摘要改写）。
2. **取回裁定**：材料回执后由用户告知裁定结果；只有审核人明确给出结论后才可执行对应后续动作。
3. **若批准发布 Migration**：仍须先补共享平台仓库 commit 与 `supabase link`、隔离环境重放、备份确认，再由唯一发布人执行；接入智能体不自行 `db push`。
4. **Mini 单设备模式继续**：保存后刷新确认、定期导出；不让旧客户端/旧 JSON/脚本写入同一数据集。
5. **恢复多设备时（按序）**：BUG-11 复测（硬刷新 → 无敏感测试卡 → 另一端变更 → 刷新仍在 → Mini MCP 调取）→ 并发冲突（旧版本提交必须明确冲突、不静默覆盖）→ MCP 双设备独立令牌与撤销隔离；QA 将真实结果写入 `docs/qa/BUGS.md`。**BUG-11 复测已于 2026-09-02 21:16–22:00 完成：未通过（状态维持 DEFERRED），关键新根因——Mini 虽已登录但页面全程落 legacy 局域网同步模式，Supabase 云写链路从未运行（保存零云写、云端 0 命中、MCP RPC 对照验证 jbyj 正常命中）；完整证据见 BUGS.md BUG-11「复测完成记录」。下一步是 Builder 排查 connect() 为何在登录态落 legacy，修复后须整轮重测步骤 0–4。**
6. **全部通过后再补一份更新版收口材料**交审核人复核，才可申请最终收口。

### 3. 注意事项与相关规矩（接续前必读）

1. **角色边界**：接续者是项目接入智能体，不是数据库审核人；不得自行宣布收口、批准发布、`db push`、改 Dashboard 或接入新数据库功能。
2. **先读规范**：数据库接入只按 V1.2；部署/自托管/云迁移只按 Docker V1.0。
3. **运行时禁区**：3100 被 Docker 占用，绝不 `./dev-server.sh start`；未经用户授权不改 Services、不重建容器、不动 DockerData / DockerBackups / Named Volume。
4. **访问地址**：只用 `http://192.168.31.60:3100`，不混用 `localhost`、`127.0.0.1`、`.local`；LAN IP 变动时先停下由用户决定 Auth 白名单调整。
5. **数据安全**：不回显/记录 AI API Key、MCP 原始令牌、数据库密码、Auth token、真实提示词正文；`.env*` 不进 Git；备份不进 Git。
6. **兼容链路保命线**：审核人明确批准前，绝不删除/停用 `data/store.json`、`/api/sync`、SSE；未登录操作只进本地抽屉。
7. **验证口径**：Docker Up、HTTP 200/401、TypeScript、Lint 均不等于云端持久化或双设备验收；只接受有设备、操作、结果的真实记录。
8. **Git**：先查 `git status`；未经用户明确授权不 commit、不 push，绝不 reset/checkout/覆盖/删除。
9. **文档归属**：收口材料正文只在 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 维护，HANDOFF 仅留指针；不得另建重复文档。

## 16.13 阶段四次收束（2026-09-02 深夜；**已被 §16.15 取代，降级为历史记录**）

> 本节原为当前唯一有效入口，已被 §16.15 取代；其中仍有效的整改清单已并入 §16.15 下一步任务。

### 1. 当前工作进展

**A. BUG-11 复测（2026-09-02 21:16–22:00，Mini 端独立 QA agent 实测）：未通过，状态维持 DEFERRED。** 完整证据见 `docs/qa/BUGS.md` BUG-11「复测完成记录」。关键结论：

- Mini 虽已登录（`wanghoufan13@gmail.com`），但页面全程落 **legacy 局域网同步模式**（aside 底栏文案为「已开启局域网实时同步（legacy）」），**Supabase 云写链路（仅 cloudMode=true 时触发）从未运行**。
- 三证据闭环：保存时零 Supabase 写请求（唯一写是 `POST :3100/api/sync`）→ 云端 `cards` 响应体搜测试卡 0 命中 → MCP RPC 查无此卡，而同链路对照调取真实在用码 `jbyj` 成功命中（RPC、令牌、配置全部正常）。
- 曾观察到的「Air 修改 3 秒同步到 Mini」是容器 SSE legacy 通道，不是 Supabase Realtime。
- **数据安全口径变化（对用户重要）**：Mini 已登录页面的新增/修改实际写入容器 legacy store（bind mount 持久），**不在 Supabase 云端**；云端仍是导入基线 53 张。修复前勿把 Mini 页面当作云端可信写入端。测试卡「BUG11-Mini-复测2」（@bug11-test2）按用户决定保留在容器 legacy store。

**B. Builder 根因排查（本轮只读代码检查，已定位问题、未改代码）：**

| # | 问题 | 位置 |
|---|---|---|
| 1 | `connect()` 云端分支要求 `loadPromptCloudSnapshot` 成功**且** `hasCloudData=true`；任何 throw/返回 null 都进静默 `catch {}`，然后**无条件 `setCloudMode(false)` 降级 legacy**——登录态下的瞬时失败（如 token 刷新中 `getUser` 报错、单表查询抖动）也会静默切到 legacy 并向容器 store 写入 | `src/app/page.tsx` L272–275（catch）与 L236（hasCloudData 门） |
| 2 | `connect()` 无互斥/序列化：`onAuthStateChange` 的**每个**事件（INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED…）都经 `SupabaseAuthControl` L29–34 派发 `prompt-manager-auth-changed` → page 每次重跑 `connect()`；并发 connect 交错执行时**后完成的 legacy 分支覆盖先完成的云端分支**（QA 观察到的「Realtime WS 曾连上但最终落 legacy」模式摇摆与此吻合） | `src/app/page.tsx` L323–343 + `src/components/SupabaseAuthControl.tsx` L22–58 |
| 3 | `loadPromptCloudSnapshot` 返回 null 的两条路径（无客户端、`getUser` 失败）与查询失败（throw）在 `connect()` 中不可区分，全部静默降级 | `src/lib/supabase/promptRepository.ts` L155–160 |

**C. connect() 修复已实施（2026-09-02 深夜，开发者）**：B 表三项根因已逐项修复（connect 代次序列化后发起者胜出；本地有会话即锁定云端模式、快照失败进云端重试态绝不写 /api/sync；登录+空库保持云端；null/throw 语义区分；auth 事件按 user id 去抖且 TOKEN_REFRESHED 不重跑；legacy 链路全部保留）。改动文件：`src/app/page.tsx`、`src/components/SupabaseAuthControl.tsx`、`src/components/TagPanel.tsx`、`src/lib/supabase/promptRepository.ts`。静态门禁全过（tsc / eslint / lint / `npm run build -- --webpack`）。完整修复记录见 `docs/qa/BUGS.md` BUG-11「开发修复二」。**尚未部署、未重测**。

**D. 其余状态不变**：收口材料待用户转交审核人（转交前须补入「Mini 登录态落 legacy」新事实与本次修复）；Migration `20260901163555` 未发布；并发冲突、MCP 双设备隔离未验收；兼容链路保留；Git 工作树未提交（不 commit/push，除非用户授权）。

### 2. 下一步任务（严格按序）

1. ~~**实施 connect() 修复**~~ ✅ 已实施（2026-09-02 深夜，见上文 C；静态门禁全过）。
2. ~~静态门禁~~ ✅ 全过。
3. **部署（等用户明确授权）**：仅同步上述 4 个改动文件至 `Services/prompt-manager` 并重建既有容器（唯一发布流程，不变更 Services 之外目录）。
4. **整轮重测 BUG-11 步骤 0–4**（用 `scratch/BUG11-复测-Mini端QA提示词-2026-09-02.md`，动手前先确认 aside 底栏为「已开启 Supabase 云端实时同步」云端文案而非 legacy 文案；含步骤 0 云端真值核对），真实结果写入 `docs/qa/BUGS.md`。
5. BUG-11 通过后依序：并发冲突（旧版本提交必须明确冲突）→ MCP 双设备令牌隔离（含 Mini 复测 BUG-9/10）。
6. 全部通过后把收口材料（含本轮 legacy 根因事实）更新为最终版交审核人复核。修订时同时落实以下此前已确认的更正：
   - BUG-11 / L3 多设备 CRUD 一律写「待验证/未通过」，不得写成通过；PC 已退出验收范围。
   - 不得声称所有表都有 `owner_user_id` 与 `revision`；只能写「核心可编辑实体使用 revision」，以实际 Migration/线上结构为准。
   - Migration `20260901163555` 写清「共享平台仓库尚无有效 HEAD/commit、未 `supabase link`、未隔离重放、未发布」。
   - `activate_prompt` 的 `SECURITY DEFINER`、`anon/authenticated` GRANT 与 Security Advisor WARN 写准确现状、控制措施与待审决定。
   - 备份结论改为「已完成 52 张卡快照恢复演练；当前 53 张卡基线的备份与恢复证据待补」（见下方第 8 项）。
7. **补当前基线备份证据**（可与 5/6 并行）：以当前云端 53 张卡为基线重新导出脱敏备份，并在隔离位置完成恢复演练，记录恢复前后计数；不覆盖生产数据。
8. 并行待办：用户把收口材料转交审核人（若不等最终版）。

### 3. 注意事项与相关规矩（接续前必读）

1. **角色边界**：接续者是项目接入智能体（Builder/QA 协调），不是数据库审核人；不自行宣布收口、不 `db push`、不改 Dashboard。
2. **运行时禁区**：3100 被 Docker 占用，绝不 `./dev-server.sh start`；未经用户授权不改 Services、不重建容器、不动 DockerData / DockerBackups / Named Volume。
3. **数据安全**：修复落地前，Mini 已登录页面写的是容器 legacy store 而非云端；不得用旧 JSON/脚本写同一数据集；不回显任何密钥、令牌、正文；`.env*` 与备份不进 Git。
4. **验证口径**：`hasCloudData` 判定、静默 catch、HTTP 200 都不等于云端持久化；只接受「写入成功回执 + 刷新仍在 + 另一端可见」三件套；QA 结果只写 `docs/qa/BUGS.md`。
5. **兼容链路保命线**：审核人批准前不删除/停用 `data/store.json`、`/api/sync`、SSE——修复方向是「登录态不再误入 legacy」，不是删除 legacy 链路（未登录兜底仍需要它）。
6. **Git**：先查 `git status`；未经用户明确授权不 commit、不 push，绝不 reset/checkout/覆盖/删除。
7. **文档归属**：收口材料正文只在 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`；Mini 端 QA 提示词在 `scratch/BUG11-复测-Mini端QA提示词-2026-09-02.md`；HANDOFF 仅指针，不建重复文档。

## 16.14 开发暂停交接（2026-09-02，历史记录；已被 §16.13 阶段四次收束取代）

> 本节原为「当前唯一有效入口」，现降级为历史记录。其中仍有效的独有要求（收口材料修订清单、53 张卡备份证据待补）已并入 §16.13 下一步任务第 6/7 项。本节的恢复提示词已过时，以 §16.13 对应的最新提示词为准。

> 用户已明确要求“开发先到这里暂时结束”。本节覆盖并取代前面所有“当前入口”小节中的最新状态表述；更早内容仅保留为历史记录。接续智能体恢复工作前，必须先阅读本节。

### 1. 当前工作进展

| 事项 | 状态 | 当前确认事实 / 边界 |
|---|---|---|
| 数据库规范 | ✅ 已生效 | 当前按 `2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md` 执行；V1.0/V1.1 仅作历史参考。 |
| Docker / 自托管规范 | ✅ 已生效 | 当前按 `2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md` 执行。 |
| Supabase 云端 | ✅ 已运行 | 项目 ref：`yacgnikzvutbpoqvokth`；Mini 已登录并能读取云端数据。当前云端基线为 53 张卡（含后续授权补传记录）。 |
| 当前运行方式 | ✅ 已确定 | 暂时使用 Mini 单设备模式；访问地址为 `http://192.168.31.60:3100`。重要保存后先刷新确认，并定期导出。 |
| Docker Runtime | ✅ 运行中 | 容器 `prompt-manager-prompt-manager-1` 占用 3100 端口；不要再运行 `./dev-server.sh start`。 |
| 共享 Supabase 收口材料 | ⚠️ 已生成但需修订 | 文件为 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`。审查结论为 `BLOCKED / CHANGES_REQUIRED`，不能当作已收口或已批准。 |
| Migration `20260901163555` | 🔒 未发布 | 文件已在共享平台仓库准备好，但该仓库当前没有有效 HEAD/提交，未完成项目 link 与隔离重放；未执行生产 `supabase db push`，也未做 Dashboard/SQL Editor 变更。 |
| 真实双设备验收 | ⏳ 未完成 | PC 已退出当前验收范围；Air/Mini 的 BUG-11 卡片持久化、可控并发冲突、MCP 双设备独立令牌与撤销隔离仍未全部验证。已有单项 Air 结果不能推导出完整双设备通过。 |
| 备份与恢复 | ⚠️ 需补当前基线证据 | 已做过 52 张卡快照的备份/恢复演练；当前云端为 53 张卡，因此不能把旧演练直接写成当前 53 张卡的完整备份证据。 |
| 兼容链路 | 🔒 必须保留 | `data/store.json`、`/api/sync`、SSE 兼容链路尚未删除或停用。已知 legacy `/api/sync` 存在整快照覆盖风险，不能把它当作唯一数据源。 |
| Git 工作树 | ⚠️ 未提交 | 当前存在未提交与未跟踪改动；禁止在未获明确授权时 reset、checkout、覆盖、删除、commit 或 push。 |

### 2. 下一步恢复任务（严格顺序）

开发暂停期间不主动执行以下任务。只有用户明确要求恢复后，才按顺序执行：

1. **先做只读盘点**：阅读根目录 `AGENTS.md`、本节、`docs/pm/PLAN.md`、数据库 V1.2、Docker V1.0、`docs/qa/BUGS.md` 以及收口材料；先检查两个仓库的 `git status`，确认实际工作树，不覆盖现有改动。
2. **修订收口材料**：只更新现有 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`，不得新建重复报告。至少修正：
   - 不得把 BUG-11 或 L3 多设备 CRUD 写成已通过；PC 已退出范围，未验证必须写“待验证/不完整”。
   - 不得声称所有表都有 `owner_user_id` 与 `revision`；当前只能表述为核心可编辑实体使用 revision，具体以实际 Migration/线上结构为准。
   - 写清 Migration 尚无有效提交、未 link、未隔离重放、未发布。
   - 对 `activate_prompt` 的 `SECURITY DEFINER`、`anon/authenticated` GRANT 及 Security Advisor WARN 给出准确现状、控制措施和待审核的安全决定。
   - 将备份结论改为“已完成 52 张卡快照恢复演练；当前 53 张卡备份证据待补”，不得继续写成当前基线全绿。
   - 将过时的 Handoff 引用改为当前唯一入口 §16.13，并标明数据库规范为 V1.2。
3. **数据库发布前门禁**：如后续确需处理 `20260901163555`，先在共享平台仓库建立可审计的真实 HEAD/commit，完成 `supabase link`、精确 SQL 审查、隔离环境重放和最新备份确认；由共享 Supabase 数据库审核人决定。接入智能体不得自行执行生产 `supabase db push`、Dashboard 变更或宣布批准。
4. **BUG-11 真实复测**：恢复第二设备后，先硬刷新 Air/Mini；Mini 新建无敏感测试卡；另一端制造一次真实云端变更；确认 Mini 卡片不消失、刷新后仍存在；再由 Mini MCP 调取该卡。失败时记录实际保存错误并停止盲目重试，不得用旧 JSON 掩盖失败。
5. **可控并发冲突验收**：一端打开旧版本编辑页，另一端先保存同一条记录；再提交旧版本，必须出现明确冲突或拒绝结果，不能静默覆盖。记录设备、时间、操作、旧 revision、新 revision、界面结果。
6. **MCP 双设备隔离验收**：Air 与 Mini 各自创建独立令牌；两端分别真实调用；只撤销 Air 令牌；确认 Mini 令牌仍可用。不得在报告中记录任何令牌原文。
7. **补当前备份与恢复证据**：以当前 53 张卡为基线重新生成脱敏备份，核对数量与关键实体；在隔离位置完成恢复演练，不覆盖当前生产数据，并记录恢复前后计数及结果。
8. **更新并转交材料**：由 QA 将真实结果写入现有 `docs/qa/BUGS.md`；接入智能体将收口材料按“已验证 / 待验证 / 存在问题”更新后，原样转交共享 Supabase 数据库审核人。只有审核人明确给出 `APPROVED_FOR_EXECUTION`，才可进入其授权范围内的后续数据库动作。

### 3. 接续必须遵守的规则

1. **角色称呼与权限**：提示词中的“你”指接续的项目接入智能体；“用户”指项目所有者；“共享 Supabase 数据库审核人”是独立审核角色。接入智能体不自审、不自批、不自行宣布收口。材料应“原样转交给共享 Supabase 数据库审核人”，不得改写成“交给我”。
2. **数据库禁区**：未经明确审核放行，不发布 Migration、不执行生产 `supabase db push`、不改 Dashboard/SQL Editor、不新增数据库功能、不修改其他 Schema。任何新项目接入共享库，都必须先提交数据库方案供审核。
3. **运行时禁区**：3100 已由 Docker 容器使用，禁止启动 `./dev-server.sh start`。没有用户明确授权，不修改 `/Users/zzymima0000/Services/prompt-manager`，不动 `DockerData`、`DockerBackups`、Named Volume，也不重建容器。
4. **访问地址**：Air/Mini 只使用 `http://192.168.31.60:3100`；不要混用 `localhost`、`127.0.0.1` 或 `.local`。局域网 IP 变化时先暂停，由用户决定是否调整 Auth 白名单。
5. **兼容保命线**：在双设备验收、恢复演练和审核人明确批准前，绝不删除或停用 `data/store.json`、`/api/sync`、SSE。发现 legacy 全快照覆盖风险时，应记录并提出独立修复方案，不得顺手删除兼容链路。
6. **验证口径**：TypeScript、Lint、构建、Docker Up、HTTP 200/401 只能证明代码或运行时局部健康，不能证明云端持久化、双设备同步、冲突处理或 MCP 隔离。真实验收必须记录实际设备、动作和结果；没有证据就写“待验证”。
7. **安全与隐私**：不得输出 AI API Key、MCP 原始令牌、数据库密码、Auth token、真实提示词正文或含敏感值的截图；`.env*`、备份和生产数据不得进入 Git。
8. **Git 与文件**：先检查 `git status`；不得 reset/checkout/覆盖/删除用户已有改动；未经用户明确授权不 commit、不 push。收口材料只维护现有唯一文件，HANDOFF 只记录入口与边界，不再新增重复报告。

### 4. 暂停期间完成标准

当前阶段的完成标准不是“数据库已收口”，而是：

- `docs/handoff/HANDOFF.md` 已记录当前真实状态和恢复顺序；
- Docker 与 Supabase 现状未被继续改动；
- Migration 未发布，旧 JSON/API/SSE 兼容链路仍保留；
- 未验证项明确保留为未验证，没有用构建或局部测试冒充双设备通过；
- 后续智能体可直接使用下方提示词恢复，并知道必须先等待用户明确恢复指令。

### 5. 下一个智能体接续恢复提示词

```text
【接续恢复 Prompt Manager：Supabase / Docker 收口】

你是“项目接入/恢复实施智能体”，不是“共享 Supabase 数据库审核人”。本提示词中的“你”只指你这个接续智能体；“用户”指项目所有者；“共享 Supabase 数据库审核人”是独立审核角色。你不得自行审核、批准、发布或宣布数据库收口。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

用户目前要求开发暂停。除非用户明确说“恢复开发/继续收口”，你只做只读检查，不改源码、不改数据库、不改 Docker、不启动服务。

开始前按顺序阅读：
1. 项目根目录 AGENTS.md
2. docs/handoff/HANDOFF.md，重点阅读最新的 §16.13；更早小节只作历史记录
3. docs/pm/PLAN.md
4. 2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md
5. 2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md
6. docs/qa/BUGS.md
7. docs/review/共享Supabase数据库接入收口材料-2026-09-02.md

当前事实：
- Supabase 项目 ref 为 yacgnikzvutbpoqvokth；Mini 已登录，当前云端基线为 53 张卡。
- Docker 容器 prompt-manager-prompt-manager-1 正在使用 3100 端口；只访问 http://192.168.31.60:3100。
- 不要使用 localhost、127.0.0.1 或 .local；不要运行 ./dev-server.sh start。
- 数据库规范以 V1.2 为准，Docker 规范以 V1.0 为准。
- 收口材料已经存在，但审查状态是 BLOCKED / CHANGES_REQUIRED，不能当作已批准。
- Migration 20260901163555 未发布；不得执行生产 supabase db push，不得改 Dashboard/SQL Editor。
- BUG-11 卡片持久化、可控并发冲突、MCP 双设备令牌隔离仍未全部验证；PC 已退出当前验收范围。
- 52 张卡快照的备份/恢复演练已做过；当前云端是 53 张卡，必须补当前 53 张卡备份证据。
- data/store.json、/api/sync、SSE 兼容链路必须保留；legacy /api/sync 存在整快照覆盖风险，不能当唯一数据源。
- 工作树有未提交/未跟踪改动；先 git status，绝不 reset、checkout、覆盖或删除。

用户明确恢复后，严格按以下顺序执行：
1. 只读检查根项目与共享平台仓库的 Git 状态、目标目录、现有文档和当前运行时；不覆盖用户改动。
2. 只更新现有 docs/review/共享Supabase数据库接入收口材料-2026-09-02.md，修正以下事实：BUG-11/L3 不得写成通过；核心实体 revision 的范围必须准确；Migration 尚无有效提交、link、隔离重放和发布；准确记录 SECURITY DEFINER / GRANT / Security Advisor WARN；明确 52 快照演练与当前 53 张卡备份的差异；引用当前 HANDOFF §16.13 与数据库 V1.2。
3. 如需处理 Migration，先取得共享 Supabase 数据库审核人明确意见；在有效 commit、项目 link、隔离重放、最新备份完成前，不得发布。你不得执行生产 supabase db push。
4. 恢复第二设备后做 BUG-11：硬刷新 Air/Mini → Mini 新建无敏感测试卡 → 另一端制造真实云端变更 → Mini 卡片不消失且刷新后仍在 → Mini MCP 调取。失败就记录真实错误并停止盲目重试，不得用旧 JSON 掩盖。
5. 做可控并发：一端保留旧 revision，另一端先保存，再提交旧版本；必须出现明确冲突/拒绝，不能静默覆盖。
6. 做 MCP 隔离：Air/Mini 各自生成独立令牌并实际调用；只撤销 Air 令牌；确认 Mini 仍能调用。报告不得出现令牌原文。
7. 以当前 53 张卡为基线做脱敏备份，并在隔离位置做恢复演练；不得覆盖生产数据。
8. 由 QA 将实际设备、时间、操作、结果写入 docs/qa/BUGS.md；更新后的收口材料必须原样转交给共享 Supabase 数据库审核人。只有收到 APPROVED_FOR_EXECUTION，才可执行审核人明确授权的数据库动作。

硬性禁区：
- 不得自行宣布收口、批准发布、执行生产 supabase db push、改 Dashboard/SQL Editor 或接入新的数据库功能。
- 不得删除或停用 data/store.json、/api/sync、SSE。
- 未经用户明确授权，不得 commit、push、修改 Services、重建容器或改 DockerData / DockerBackups / Named Volume。
- 不得泄露 API Key、MCP 原始令牌、数据库密码、Auth token、真实提示词正文或敏感截图。
- 没有真实设备与操作证据就标记为“待验证”，不要把构建、HTTP 200/401、Lint 或 Docker Up 当成多设备验收通过。

输出要求：每项写清“已验证 / 待验证 / 存在问题”，给出文件路径、命令结果和实际设备证据；遇到权限、项目 link、数据或线上状态不确定时先停下并报告，不要自行扩大权限或范围。
```

## 16.15 阶段五次收束（2026-09-02 深夜，用户指示「开发先到这里暂时结束」；当前唯一有效入口）

> 本节取代 §16.13/§16.14 成为当前唯一有效入口；更早小节仅作历史记录。

### 1. 当前工作进展

**A. BUG-11 根因修复（connect 模式选择）已实施并部署**：

| 事项 | 状态 | 事实 |
|---|---|---|
| 修复实施 | ✅ | 四项根因逐项修复：① connect() 代次序列化（后发起者胜出）；② 登录态锁定云端模式（本地有会话即已登录，快照失败 → 云端重试态：退避重连 + 横幅「云端暂时不可用」，绝不写 /api/sync）；③ `loadPromptCloudSnapshot` 登录态失败改 throw 与空库区分，登录+空库保持云端等待显式导入；④ auth 事件带 user id 去抖、TOKEN_REFRESHED 不重跑 connect |
| 改动文件 | ✅ | `src/app/page.tsx`、`src/components/SupabaseAuthControl.tsx`、`src/components/TagPanel.tsx`、`src/lib/supabase/promptRepository.ts`；legacy 链路（data/store.json、/api/sync、SSE）全部保留 |
| 静态门禁 | ✅ | tsc / eslint（0 error）/ npm run lint / `npm run build -- --webpack` 全过 |
| 部署（用户授权） | ✅ | 4 文件同步 `Services/prompt-manager` SHA 一致（page.tsx `c8b5d745…`、AuthControl `15fe70cf…`、TagPanel `2121be1a…`、promptRepository `973b81c8…`）；容器重建 Up 0.0.0.0:3100，首页/`/api/sync` 200 |

**B. BUG-11 整轮重测步骤 0–1 已通过（Mini 端 QA 实测，完整证据见 `docs/qa/BUGS.md` BUG-11「复测第二轮记录」）**：

- 先决 ✅：aside 底栏 = **「已开启 Supabase 云端实时同步」**（云端模式，不再是 legacy）；已登录 `wanghoufan13@gmail.com`。
- 步骤 0 ✅：页面 53 张 = 云端基线；legacy 测试卡未混入；5 表 SELECT 全 200；Realtime WS 建连握手。
- 步骤 1 ✅：UI 新建测试卡 → `POST cards 201`、`PATCH cards 200`、`POST prompt_tags 201`（修复前云写为零）；硬刷新后仍在（54 张）；**云端直查命中**：`prompt_manager.cards` `code=bug11-test2` 1 行（title「BUG11-Mini-复测3」，copy_count 0），云端总数 54。
- **测试卡现状：BUG11-Mini-复测3 @bug11-test2 已在 Supabase 云端**（id `2516da58-e90b-434c-aed1-66482b97a24e`）；容器 legacy store 里另有旧卡「BUG11-Mini-复测2」@bug11-test2（同名不同库，不冲突，MCP 只读云端）。

**C. 步骤 2–4 已全部通过（2026-09-03 上午，用户在 Air 端配合；完整证据见 `docs/qa/BUGS.md` BUG-11「复测第二轮完成记录」）**：

| 步骤 | 结果 | 关键证据 |
|---|---|---|
| 2 Realtime 同步 | ✅ | Air 保存后 Mini **未刷新**（页面已连续运行 12h，reloadCount=0）首次轮询 T+2s 即显示「BUG11-Mini-复测-Air改」；Realtime 触发 5 表回读全 200 |
| 3 旧快照覆盖判据 | ✅ | Mini 硬刷新后 54 张、Air 修改仍在；云端直查 title=BUG11-Mini-复测-Air改 |
| 4 MCP 调取 | ✅ | 协议级真调 `bug11-test2` → activated（返回 Air 最新标题）；云端 `copy_count` 0→1 |
| 附：BUG-9 Mini 复测 | ✅ | 生成令牌 `POST /api/mcp-access-tokens → 200`，无 crypto 错误 |
| 附：BUG-10 Mini 复测 | ✅ | 受信任点击复制 →「已复制」；剪贴板与一次性内容长度+FNV 哈希一致（253/`564a7184`）；复测令牌已撤销（PATCH 204），Mini 在用「Mac Mini」令牌保留 |

**C2. 收口验收进度总览（2026-09-03）**：

| 验收项 | 状态 | 记录 |
|---|---|---|
| BUG-11 卡片持久化 + 跨端同步 | ✅ FIXED | BUGS.md「复测第二轮记录/完成记录」 |
| 并发冲突（明确提示、不静默覆盖） | ✅ 通过 | BUGS.md「并发冲突验收记录」 |
| MCP 双设备令牌隔离（含撤销负向） | ✅ 通过 | BUGS.md「MCP 双设备令牌隔离验收记录」 |
| BUG-9 / BUG-10 Mini 复测 | ✅ 通过 | 同上（随 BUG-11 复测完成） |
| 基线备份证据（55 张） | ✅ 完成 | BUGS.md「基线备份与隔离恢复演练记录」：dump 三件 + 隔离恢复零错误 + 验证全绿 + 容器零残留 |
| 收口材料最终版 | ✅ 已修订（2026-09-03） | `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`；**待用户原样转交审核人** |

观察项（列入收口材料）：写队列停摆（冲突风暴+延迟仿真后重试链死亡，待开发定级）；连字符调取码经自然语言调用被改写（建议调取码规则避开连字符）；Air 克隆停留在 mcp-delivery 分支、master 与远端分叉待整合。

**D. QA 现场遗留（暂停时仍在运行）**：

- 专用 Chrome（profile `/tmp/qa-bug11-chrome`，CDP 9223）打开在 `http://192.168.31.60:3100` 已登录页（54 张、云端模式）。
- 网络监听 `scratch/bug11-netmon.mjs` 仍在运行 → `/tmp/bug11_net.jsonl`。
- ⚠️ `/tmp` 重启即清空：若 profile 丢失，需用户本人在该 Chrome 重新登录（QA 不得自行登录）。重启命令：
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir=/tmp/qa-bug11-chrome --remote-debugging-port=9223 --no-first-run --no-default-browser-check "http://192.168.31.60:3100" &`
- 辅助脚本：`scratch/bug11-eval.mjs`（CDP 求值）、`scratch/bug11-mcp-call.mjs`（协议级 MCP 真调，不回显令牌）、`scratch/BUG11-复测-Mini端QA提示词-2026-09-02.md`（验收口径与 Air 端配合动作）。

**E. 其余状态不变**：Migration `20260901163555` 未发布；并发冲突、MCP 双设备隔离未验收；兼容链路保留；Git 工作树未提交（`bb32e42` 已 commit 未 push，另有未提交修改与未跟踪项）；收口材料待审（自评 BLOCKED/CHANGES_REQUIRED）。

### 2. 下一步任务（严格按序）

1. ~~恢复 QA 环境 / BUG-11 步骤 2–4 / BUG-9、10 Mini 复测 / QA 写结果~~ ✅ 全部完成（2026-09-03 上午，见上文 C；QA 结果已写入 `docs/qa/BUGS.md`，BUG-11 已标 FIXED）。
2. ~~**并发冲突验收**~~ ✅ 通过（2026-09-03 上午：Air + Mini 同时写入同卡，Mini 明确 toast 冲突提示、被拒写入未静默生效、Air 内容完好；详见 `docs/qa/BUGS.md`「并发冲突验收记录」。附带发现写队列停摆观察项，待开发定级）。
3. ~~**MCP 双设备令牌隔离验收**~~ ✅ 通过（2026-09-03 下午：先修复 Air 端根因——Air 跑的是 8/29 旧版本地文件版 MCP server，已切 mcp-delivery 分支构建 0.2.0 + 注入新令牌 + 清理 10 个长驻旧进程；随后 Air 新令牌真实调取成功（云端「上次使用」13:56:09、copy_count 递增）→ 撤销「MacBook Air」令牌（14:04:55）→ Air 协议级真调被拒（isError=true，文案与预期一致）+ Mini 调取仍成功。详见 `docs/qa/BUGS.md`「MCP 双设备令牌隔离验收记录」。注意：Air 克隆现停在 mcp-delivery 分支；master 与远端 master 的分叉整合待办（需用户授权）。
4. ~~**补当前基线备份证据**~~ ✅ 完成（2026-09-03 14:22–14:35：55 卡基线 dump 三件入 DockerBackups + 隔离恢复演练零错误 + 验证全绿，生产零写入；见 `docs/qa/BUGS.md`「基线备份与隔离恢复演练记录」）。
5. ~~**收口材料更新为最终版**~~ ✅ 已完成（2026-09-03）：`docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 已按要求修订（①–⑦ 全部纳入）。**剩余动作 = 用户将文件原样转交共享 Supabase 数据库审核人复核**；接入智能体不得自行宣布收口。
6. ~~**测试卡清理**~~ ✅ 终态（2026-09-03，用户决策）：12 张带码测试卡已经界面批量删除；1 张无码「未命名提示词」（12:29:56）经用户决定**保留在云端**；容器 legacy「BUG11-Mini-复测2」保留。**当前云端总数 54**（53 真实 + 1 保留测试卡），后续对账以此为准。

### 3. 注意事项与相关规矩（接续前必读）

1. **角色边界**：接续者是项目接入智能体（Builder/QA 协调），不是数据库审核人；不自行宣布收口、不批准发布、不 `supabase db push`、不改 Dashboard/SQL Editor、不接入新数据库功能。
2. **运行时禁区**：3100 被 Docker 容器占用，绝不 `./dev-server.sh start`；容器重建仅用 `cd /Users/zzymima0000/Services/prompt-manager && docker compose --env-file .env.local up -d --build`；未经用户授权不改 Services、不动 DockerData / DockerBackups / Named Volume。
3. **部署边界**：唯一发布流程 = 改动源码同步至 Services + 重建既有容器（同步后核对 SHA-256）；必须先获用户明确授权；`.env.local`（600 权限）不提交。
4. **访问地址**：只用 `http://192.168.31.60:3100`（含 Mini 本机）；不混用 `localhost`/`127.0.0.1`/`.local`（不在 Supabase 白名单/被代理劫持）。
5. **数据安全**：不回显/记录 AI API Key、MCP 原始令牌、数据库密码、Auth token、真实提示词正文；publishable key 属公开键可用于只读核验；备份不进 Git。
6. **云端核验口径**：REST/RPC 核验必须显式指定业务 Schema（header `Accept-Profile: prompt_manager`），不能默认 public；「已保存到云端」唯一判据 = 写入成功回执 + 刷新仍在 + 另一端可见；HTTP 200/构建/页面即时显示都不算云端持久化。
7. **兼容链路保命线**：审核人批准前绝不删除/停用 `data/store.json`、`/api/sync`、SSE；登录态已锁定云端模式，但未登录兜底仍依赖 legacy，不得顺手删。
8. **QA 自动化**：PreviewPanel 标题/调取码编辑用合成 input 事件不可靠（草稿不进 React 状态），需真实键盘输入或点「保存」按钮；Mini QA 不得自行登录 Google 账号。
9. **Git**：先 `git status`；未经用户明确授权不 commit/push，绝不 reset/checkout/覆盖/删除。
10. **文档归属**：QA 结果只写 `docs/qa/BUGS.md`；收口材料只在 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 维护；HANDOFF 只留指针；不新建重复文档。

### 4. 下一个智能体接续恢复提示词

```text
【恢复 Prompt Manager 丨 并发冲突验收 → MCP 双设备隔离 → 基线备份 → 收口材料最终版】

你现在是「项目接入智能体」兼 Builder/QA 协调者，不是共享 Supabase 数据库审核人。BUG-11 已修复闭环（复测 0–4 全过）、BUG-9/10 已双端验证；当前任务：按序完成并发冲突验收与 MCP 双设备隔离验收。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

开始前按顺序完整阅读：
1. AGENTS.md
2. docs/handoff/HANDOFF.md —— §16.15 是当前唯一有效入口（更早小节仅作历史）
3. docs/qa/BUGS.md —— BUG-11「复测第二轮完成记录」（已 FIXED）与 BUG-9/10 状态
4. 2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md（§3.3 判定标准、§9 并发、§11 验收层级）

当前事实（已验证，不要重复折腾）：
- Mini 页面为云端模式（aside 底栏「已开启 Supabase 云端实时同步」），云写链路、Realtime、MCP 调取全部正常；云端现 54 张。
- QA 现场：专用 Chrome（profile /tmp/qa-bug11-chrome，CDP 9223）+ netmon（scratch/bug11-netmon.mjs）；重启恢复命令见 §16.15 D。
- Mini 在用 MCP 令牌 label「Mac Mini」完好；复测令牌「这台电脑」已撤销（PATCH 204）。
- 测试卡「BUG11-Mini-复测-Air改」@bug11-test2 在云端待清理；容器 legacy 另有旧「BUG11-Mini-复测2」。
- Migration 20260901163555 未发布；data/store.json、/api/sync、SSE 保留；Git 未提交（除 bb32e42）；收口材料待修订。

恢复工作顺序：
1. 并发冲突验收：Air 先保存同一条记录，Mini 保留旧编辑版本后再提交 → 必须出现明确冲突处理、不得静默覆盖；记录设备、时间、旧/新 revision、界面结果。
2. MCP 双设备令牌隔离：Air 创建独立令牌并实际调取；Mini 用「Mac Mini」令牌实际调取；仅撤销 Air 令牌 → Mini 令牌仍可调取（负向验证：被撤销令牌调 RPC 必须被拒）。不记录令牌原文。
3. 补当前基线备份证据：以当时云端卡数导出脱敏备份 + 隔离恢复演练，记录前后计数。
4. QA 把真实结果写入 docs/qa/BUGS.md。
5. 收口材料更新为最终版（含 legacy 根因事实、BUG-11 闭环、§16.13 更正清单），原样交共享 Supabase 数据库审核人复核；不得自行宣布收口。
6. 测试卡清理由用户决定（界面操作）。

硬性禁区：
- 不自行宣布收口、批准发布、执行生产 supabase db push、改 Dashboard/SQL Editor 或接入新数据库功能。
- 未经用户明确授权，不改 Services、不重建容器、不动 DockerData / DockerBackups / Named Volume、不 commit、不 push。
- 不泄露任何密钥、原始令牌、数据库密码、Auth token 或真实提示词正文。
- 不删除/停用 data/store.json、/api/sync、SSE；不把 HTTP 200、构建、静态检查写成云端/多端验收通过。
- REST/RPC 云端核验必须带 Accept-Profile: prompt_manager；QA 不得自行登录 Google 账号。
```

## 16.16 阶段六次收束（2026-09-03，用户指示「开发先到这里暂时结束」；当前唯一有效入口）

> 本节取代 §16.15 成为当前唯一有效入口；更早小节仅作历史记录。本项目侧验收已全部完成，当前球在两处：①用户把收口材料转交审核人并取回裁定；②开发待办（写队列停摆等）等用户启动。

### 1. 当前工作进展

**A. 验收与交付总览（全部完成，2026-09-02 ~ 09-03）**：

| 事项 | 状态 | 记录位置 |
|---|---|---|
| BUG-11（卡片持久化 + 跨端同步） | ✅ FIXED | `docs/qa/BUGS.md`「复测第二轮记录/完成记录」：connect() 四项修复（代次序列化 / 登录态锁定云端 + 云端重试态 / null-throw 区分 + 空库保持云端 / auth 事件去抖 + TOKEN_REFRESHED 跳过），复测步骤 0–4 全过（云写 201/200、刷新仍在、Realtime T+2s、旧快照覆盖未发生、MCP 调取命中 + copy_count 递增） |
| 并发冲突验收 | ✅ 通过 | BUGS.md「并发冲突验收记录」：Mini 明确 toast 冲突提示、被拒写入未静默生效、Air 内容完好（LWW 收敛） |
| BUG-9 / BUG-10 Mini 复测 | ✅ 通过 | 同上（令牌生成 200；复制哈希比对一致） |
| MCP 双设备令牌隔离 | ✅ 通过 | BUGS.md「MCP 双设备令牌隔离验收记录」：Air 根因修复（旧版本地文件版 server → 切 `origin/mcp-delivery` 构建 0.2.0）→ Air 调取成功（last_used 13:56:09）→ 撤销 MacBook Air 令牌（14:04:55）→ Air 被拒（isError=true 文案一致）+ Mini 仍通 |
| 55 卡基线备份 + 隔离恢复演练 | ✅ | BUGS.md「基线备份与隔离恢复演练记录」：dump 三件（`DockerBackups/prompt-manager/`，timestamp 20260903-142203）+ 隔离恢复零错误 + 验证全绿（RLS 6×4、孤儿 0、码 6/6 唯一、settings 无密钥列、RPC 拒绝正确）；生产零写入 |
| **收口材料最终版** | ✅ 已修订 | `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`（2026-09-03 修订版，§0–§8 全部更新：更正清单 + 新验收证据 + 三观察项）；**待用户原样转交审核人** |

**B. 观察项（已列入收口材料 §6，待开发/产品处理）**：

1. **写队列停摆（待开发定级）**：并发冲突风暴 + 20s 延迟仿真后，Mini 写队列死亡（重试链停止、后续本地编辑零网络请求、本地云端持续分歧），刷新恢复；疑 supabase-js fetch 无超时 + 串行队列被未决请求阻塞。与规范 §9.2「失败不能静默丢弃」存在张力。
2. **连字符调取码（产品评估）**：自然语言调用下含连字符的调取码（`bug11-test2`）实测被改写致「未找到」；无杠码稳定。建议调取码规则避开连字符或文档明确。
3. **git 分叉整合（需用户授权）**：应用仓库 `origin/master` 含另一工作线 7 提交，本地 `bb32e42` 已推为 `origin/mcp-delivery`；两线合并需谨慎处理（本地有未提交工作树改动，含今日 connect 修复与文档更新）。Air 克隆现停在 `mcp-delivery` 分支。

**C. 今日代码与文档改动（全部未提交）**：

- 代码：`src/app/page.tsx`、`src/components/SupabaseAuthControl.tsx`、`src/components/TagPanel.tsx`、`src/lib/supabase/promptRepository.ts`（connect 修复，已部署至 Services 并验证）
- 文档：`docs/qa/BUGS.md`、`docs/handoff/HANDOFF.md`、收口材料
- 此前遗留未提交项仍在（`src/lib/supabase/mcpTokens.ts`、`src/components/McpCloudAccess.tsx`、`src/lib/ai.ts`、`docker/env.template`、`supabase/`、`src/app/api/mcp-access-tokens/`、两份规范文档等）
- Git：`bb32e42` 已推为 `origin/mcp-delivery`；`origin/master` 含另一工作线 7 提交；本地 master 未推送（分叉待整合）

**D. 现场与数据状态**：

- 云端基线：**54 张卡**（53 真实 + 1 张用户决定保留的无码测试卡「未命名提示词」，今天 12:29:56 建）；调取码 6 枚唯一；MCP 令牌 3 枚在用（MAC MINI 旧 / Mac Mini = Mini 现用 / MacBook Air = **已撤销**的隔离验收用令牌）
- 容器 legacy store 保留测试卡「BUG11-Mini-复测2」（另一套存储，无害）
- QA 现场：专用 Chrome（profile `/tmp/qa-bug11-chrome`，CDP 9223）仍打开在应用页面（云端模式）；netmon 已结束；`/tmp` 重启即清空（重启后 QA Chrome 需用户重新登录；恢复命令见 §16.15 D）
- 辅助脚本留存：`scratch/bug11-*.mjs`（eval / netmon / mcp-call / cdp-click / cdp-clickxy / cdp-throttle / cdp-type / cdp-front / scan-codex）

**E. 其余不变**：Migration `20260901163555` 未发布（平台仓库无 HEAD/link）；兼容链路（`data/store.json`、`/api/sync`、SSE）保留；PC 退出验收范围；**收口材料最终版待用户转交审核人，裁定未发生**。

### 2. 下一步任务（严格按序）

1. **收口材料转交与裁定（外部依赖，当前第一优先）**：用户把 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 原样转交共享 Supabase 数据库审核人 → 取回裁定（`APPROVED_FOR_EXECUTION` / `CHANGES_REQUIRED` / `BLOCKED`）。
2. **按裁定行动**：
   - 若放行：后续数据库动作（如 Migration `20260901163555` 发布）仍按 §7.2 门禁走（平台仓库 commit/link、隔离重放、备份确认、唯一发布人执行）；
   - 若 `CHANGES_REQUIRED`：按审核意见逐条整改后重新提交；
   - 若 `BLOCKED`：停止相关动作，等待用户指示。
3. **开发待办（需用户启动，可与 1 并行）**：写队列停摆修复——先复现定级（可参考 BUGS.md 观察项的触发记录），再实施（候选方向：写队列单项超时 + 冲突后自愈、`retryCloudSync` 链路健壮性），完成后按「静态门禁 → 用户授权部署 → 真机复测」闭环。
4. **git 分叉整合（需用户明确授权）**：本地工作树先处理未提交改动（用户决定提交范围），再合并 `origin/master`（另一工作线 7 提交）与本地 master；合并后如需可让 Air 克隆回归主线分支。
5. **小项**：用户界面确认删除遗留 1 张无码测试卡（若改变主意）；QA Chrome 用完关闭；`scratch/bug11-cdp-*.mjs` 等临时脚本可留作记录或清理。

### 3. 注意事项与相关规矩（接续前必读，含 §16.15 全部条款）

1. **角色边界**：接续者是项目接入智能体，不是数据库审核人；不自行宣布收口、不批准发布、不 `supabase db push`、不改 Dashboard/SQL Editor、不接入新数据库功能。
2. **运行时禁区**：3100 被 Docker 容器占用，绝不 `./dev-server.sh start`；容器重建仅 `cd /Users/zzymima0000/Services/prompt-manager && docker compose --env-file .env.local up -d --build`；未经用户授权不改 Services、不动 DockerData / DockerBackups / Named Volume。
3. **部署边界**：唯一发布流程 = 改动源码同步 Services + 重建既有容器（同步后核对 SHA-256）；必须先获用户明确授权。
4. **访问地址**：只用 `http://192.168.31.60:3100`；不混用 `localhost`/`127.0.0.1`/`.local`。
5. **数据安全**：不回显/记录任何令牌、密钥、密码、真实正文；publishable key 为公开键可用于只读核验；REST/RPC 核验必须带 `Accept-Profile: prompt_manager`；备份不进 Git。
6. **兼容链路保命线**：审核人批准前绝不删除/停用 `data/store.json`、`/api/sync`、SSE。
7. **验证口径**：只认「写入回执 + 刷新仍在 + 另一端可见」三件套；HTTP 200/构建/静态检查不算云端或跨端验收；每份记录标明设备、时间、操作、结果。
8. **Git**：先 `git status`；未经用户明确授权不 commit/push；绝不 reset/checkout/覆盖/删除用户改动；`origin/master` 的分叉整合必须单独获得授权。
9. **文档归属**：QA 结果只写 `docs/qa/BUGS.md`；收口材料只在 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 维护；HANDOFF 只留指针；不新建重复文档。
10. **QA 自动化**：临时探针脚本在 `scratch/`；PreviewPanel 编辑需真实键盘输入或「保存」按钮；合成事件与无手势点击不可靠；QA 不得自行登录 Google 账号。

## 16.17 阶段七次收束（2026-09-03，用户指示「开发先到这里暂时结束」；当前唯一有效入口）

> 本节取代 §16.16 成为当前唯一有效入口；更早小节仅作历史记录。本次为收口材料最终版（2026-09-03 修订版）后的正式交接收束，**球在审核人**——用户需把收口材料原样转交共享 Supabase 数据库审核人，等裁定后再恢复开发。

### 1. 当前工作进展

**A. 收口材料最终版已修订完成（2026-09-03）**：

| 章节 | 内容 | 状态 |
|---|---|---|
| §0 | 验收层级总览 L0–L5 全部 ✅（L5 审核裁定待给出）+ 修订说明 | ✅ |
| §1 | 完成工作总表（含 BUG-11 修复闭环四项 + 当日部署与验收） | ✅ |
| §2 | Migration 状态（`20260901163555` 未发布、平台仓库门禁缺口如实写明） | 📄/❌ |
| §3 | Schema/RLS/Realtime/敏感边界（按实测表述：revision 以 cards 实测为准；settings 结构性无密钥列） | ✅ |
| §4 | 双设备验收：BUG-11 复测 0–4、并发冲突、MCP 隔离（含 Air 旧版 server 根因与撤销负向验证） | ✅ |
| §5 | 两轮备份演练（52 卡首演 + 55 卡复演）全绿 | ✅ |
| §6 | 问题/观察项清单：写队列停摆、连字符调取码、git 分叉、legacy 覆盖风险、PC 退出等 10 项如实列出 | ✅ |
| §7 | 需审核人裁定的 5 项（SECURITY DEFINER、Migration 发布、收口放行、legacy 下线、补传追认） | ⏳ |
| §8 | 声明确认 | ✅ |

- 唯一载体：`docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`（2026-09-03 修订版，167 行，§0–§8 全量）；**待用户原样转交审核人**（同机可直接给路径），等裁定结果。
- 自评结论：L0–L4 已验证通过，L5 备份演练全绿，审核裁定待给出；不自行宣布 `APPROVED_FOR_EXECUTION` / `VERIFIED`。

**B. 验收与交付总览（全部完成，2026-09-02 ~ 09-03，记录位置 `docs/qa/BUGS.md`）**：

| 事项 | 状态 | 关键事实 |
|---|---|---|
| BUG-11 卡片持久化 + 跨端同步 | ✅ FIXED | connect() 四项修复（代次序列化 / 登录态锁定云端+重试态 / null-throw区分+空库保持云端 / auth去抖）部署并复测 0–4 全过（云写 201/200、刷新仍在、Realtime T+2s、MCP调取命中） |
| 并发冲突验收 | ✅ 通过 | Mini 明确 toast「云端卡片保存失败…请刷新」+ 被拒写入未生效 + Air 内容完好（LWW 收敛 rev 8→39） |
| BUG-9 / BUG-10 Mini 复测 | ✅ 通过 | 令牌生成 200；复制哈希一致 253/`564a7184` |
| MCP 双设备令牌隔离 | ✅ 通过 | Air 旧版 server 根因修复（切 `origin/mcp-delivery` 构建 0.2.0 + 清理 10 旧进程）→ Air 调取成功（last_used 13:56:09）→ 撤销 MacBook Air（14:04:55）→ Air 被拒 isError=true + Mini 仍通 |
| 55 卡基线备份 + 隔离恢复演练 | ✅ 全绿 | dump 三件 `DockerBackups/prompt-manager/` (20260903-142203) + 隔离恢复零错误 + 验证全绿（RLS 6×4、孤儿 0、码 6/6 唯一、settings 无密钥列） |
| 应用仓库交付分支 | ✅ | 本地 `bb32e42` 已推为 `origin/mcp-delivery`（含新版 MCP server）；`origin/master` 含另一工作线 7 提交待整合 |

**C. 规范与运行时**：

| 事项 | 状态 | 事实 |
|---|---|---|
| 数据库规范 | ✅ V1.2 生效 | `2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md` |
| Docker 规范 | ✅ V1.0 生效 | `2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md` |
| Supabase 云端 | ✅ 运行 | 项目 `yacgnikzvutbpoqvokth`；Mini 已登录；当前云端 **54 张**（53 真实 + 1 张用户决定保留的无码「未命名提示词」12:29:56）；调取码 6 枚唯一 |
| Docker Runtime | ✅ 运行中 | `prompt-manager-prompt-manager-1` Up 16h+，绑定 `0.0.0.0:3100`；禁止 `./dev-server.sh start` |
| Migration `20260901163555` | ✅ 已批准待发布 | `supabase/migrations/20260901163555` 1,732 B (`83dc8b36…`)，线上语义一致；平台 HEAD `efddca5` 已建 + 已 `supabase link` + 管理员隔离重放零错误（PG16，裁定 §一.6）；**仅剩唯一发布人 `migration up` 登记**（裁定 APPROVED_FOR_EXECUTION） |
| 兼容链路 | 🔒 保留 | `data/store.json`、`/api/sync`、SSE 未删未停；legacy 覆盖风险已记录 |
| Git 工作树 | ⚠️ 未提交 | 见下 E；不得 reset/checkout/覆盖/删除/commit/push，除非用户明确授权 |

**D. 现场与数据**：

- 云端：54 张卡（6 码唯一）；MCP 令牌总数 10 行（backup 演练实测，含已撤销；活跃 2、在用撤销 1、历史 7），与收口材料 §5 一致
- 容器 legacy store 保留测试卡「BUG11-Mini-复测2」无害可留
- 平台仓库：`/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库` 现有 HEAD `efddca5`（2026-09-03 14:48，含 `20260901163555` 待发布 + habit_tracker `20260903141849`）；`supabase/.temp/project-ref` + `linked-project.json` 已在位（已 link），管理员隔离重放零错误（裁定 §一.6）；发布前仅剩唯一发布人登记
- QA 现场：专用 Chrome（`/tmp/qa-bug11-chrome` CDP 9223）仍开着（可随手关掉）；netmon 已结束；`/tmp` 重启即清空需重登
- 辅助脚本留存：`scratch/bug11-*.mjs`、`scratch/BUG11-复测-Mini端QA提示词-2026-09-02.md`、`scratch/restore-drill/`

**E. 今日代码改动仍未 commit（用户授权过的 push 仅 `mcp-delivery` 分支）**：

```
 D "2026-08-31 丨 macOS 丨 Codex 桌面端 丨 多端数据存储与 Supabase 同步-SOP 丨 V1.0.md"
 D "2026-09-01 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.0.md"
 D "2026-09-02 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.1.md"
 M docker/env.template
 M docs/handoff/HANDOFF.md
 M docs/pm/PLAN.md
 M docs/qa/BUGS.md
 M src/app/page.tsx
 M src/components/McpCloudAccess.tsx
 M src/components/SupabaseAuthControl.tsx
 M src/components/TagPanel.tsx
 M src/lib/ai.ts
 M src/lib/supabase/mcpTokens.ts
 M src/lib/supabase/promptRepository.ts
?? "2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md"
?? "docs/review/共享Supabase数据库接入收口材料-2026-09-02.md"
?? src/app/api/mcp-access-tokens/
?? supabase/
```

- 要不要提交、何时提交由用户决定；**未经明确授权不 commit/push**。
- `origin/master` 与本地 master 分叉整合待办（7 提交差异）。

### 2. 下一步任务（严格按序）

1. **收口材料转交与裁定（外部依赖，当前第一优先）**：用户把 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` **原样转交**共享 Supabase 数据库审核人（同机直接给路径；跨机/给人则发文件或粘贴全文，不得摘要改写）→ 取回裁定（`APPROVED_FOR_EXECUTION` / `CHANGES_REQUIRED` / `BLOCKED`）。
2. **按裁定行动**：
   - 若 `APPROVED_FOR_EXECUTION`：后续数据库动作（如 `20260901163555` 发布）仍按门禁走——平台仓库 commit/link、隔离重放、备份确认、唯一发布人执行；应用侧 Git 分叉整合亦在授权后执行；
   - 若 `CHANGES_REQUIRED`：按审核意见逐条整改后重新提交收口材料；
   - 若 `BLOCKED`：停止相关动作，等待用户指示。
3. **开发待办（需用户启动，可与 1 并行；不阻塞收口转交）**：
   - **写队列停摆修复（建议尽早）**：复现定级（参考 BUGS.md 并发冲突验收「写队列停摆」观察项：20s 延迟 + 冲突风暴后重试链死亡，本地编辑零请求、分歧持续），再实施候选方向（写队列单项超时 + 自愈、`retryCloudSync` 健壮性、fetch 超时），完成后按「静态门禁 → 用户授权部署 → 真机复测」闭环。
   - **连字符调取码规则（产品评估）**：自然语言调用会改写含 `-` 的码（`bug11-test2` 未命中，无杠码稳定）；决定调取码规则避开连字符或在 MCP 工具描述/文档中明确。
4. **git 分叉整合（需用户明确授权）**：先处理未提交工作树（用户决定提交范围），再合并 `origin/master`（另一工作线 7 提交）与本地 master；合并后按需让 Air 克隆回归主线。
5. **小项（不阻塞）**：
   - 用户界面确认是否清理遗留 1 张无码测试卡（当前决定保留，若改主意则界面删除）；
   - QA Chrome 随手关掉（`lsof -i :9223` / 关闭窗口）；容器 legacy 测试卡无害可留；`scratch/bug11-cdp-*.mjs` 等临时脚本可留作记录或清理。

### 3. 注意事项与相关规矩（接续前必读，含 §16.16 全部条款 + 本轮增补）

1. **角色边界**：接续者是项目接入智能体，不是数据库审核人；**不自行宣布收口、不批准发布、不 `supabase db push`、不改 Dashboard/SQL Editor、不接入新数据库功能**；收口材料必须原样转交审核人，不得改写成「已批准」。
2. **先读规范**：数据库接入只按 V1.2；部署/自托管/云迁移只按 Docker V1.0；两者按「数据库 / Runtime」分工不重复维护。
3. **运行时禁区**：3100 被 Docker 占用，**绝不 `./dev-server.sh start`**；容器重建仅 `cd /Users/zzymima0000/Services/prompt-manager && docker compose --env-file .env.local up -d --build`；未经用户授权不改 Services、不动 DockerData / DockerBackups / Named Volume。
4. **访问地址**：只用 `http://192.168.31.60:3100`；不混用 `localhost`/`127.0.0.1`/`.local`（不在白名单/被代理劫持）；LAN IP 变动先停下由用户决定 Auth 白名单调整。
5. **数据安全**：不回显/记录 AI API Key、MCP 原始令牌、数据库密码、Auth token、真实提示词正文；`.env*`、备份不进 Git；publishable key 为公开键可用于只读核验；REST/RPC 核验必须带 `Accept-Profile: prompt_manager`。
6. **兼容链路保命线**：审核人明确批准前，**绝不删除/停用 `data/store.json`、`/api/sync`、SSE**；登录态已锁定云端模式但未登录兜底仍依赖 legacy，不得顺手删；legacy 覆盖风险已记录。
7. **验证口径**：只认「写入回执 + 刷新仍在 + 另一端可见」三件套；HTTP 200/401、构建、Lint、Docker Up 均不等于云端持久化或双设备验收；每份记录标明设备/时间/操作/结果；PC 已退出验收范围。
8. **Git**：先 `git status`；未经用户明确授权不 commit/push；绝不 reset/checkout/覆盖/删除用户改动；`origin/master` 的分叉整合必须单独获得授权；**今日改动未 commit，要不要提交由用户决定**。
9. **文档归属**：QA 结果只写 `docs/qa/BUGS.md`；收口材料只维护 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`；HANDOFF 只留指针；不新建重复文档；收口材料正文不得在 HANDOFF 重复。
10. **QA 自动化与现场**：临时探针在 `scratch/`；PreviewPanel 标题/调取码需真实键盘或「保存」按钮；合成事件与无手势点击不可靠；QA 不得自行登录 Google 账号；专用 Chrome 在 `/tmp` 重启即清空；容器 legacy 测试卡无害可留。

### 4. 下一个智能体接续恢复提示词（一键复制，直接在当前对话窗口中给出）

```text
【恢复 Prompt Manager｜等审核裁定 + 择机收尾】

你是「项目接入智能体」，不是共享 Supabase 数据库审核人。本项目验收已全部完成，收口材料最终版（2026-09-03 修订版）待转交审核人裁定；当前为 Mini 单设备安全运行期。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

开始前按顺序完整阅读（只读，不改代码/数据库/Docker）：
1. AGENTS.md
2. docs/handoff/HANDOFF.md —— §16.17 是当前唯一有效入口（更早小节仅历史）
3. docs/review/共享Supabase数据库接入收口材料-2026-09-02.md（2026-09-03 修订版，§0–§8）
4. docs/qa/BUGS.md —— BUG-11「复测第二轮完成记录」、并发冲突、MCP 隔离、备份演练
5. 2026-09-03 丨 共享 Supabase 项目与独立 Schema 数据库规范 丨 V1.3.md
6. 2026-09-02 丨 Mac Mini 本地项目自托管 Docker 规范 丨 V1.0.md
7. docs/pm/PLAN.md

当前事实（已验证，不要重复折腾）：
- L0–L4 全部 ✅：BUG-11 四项修复闭环（connect 代次序列化/登录态锁定云端+重试态/null-throw区分/auth去抖）部署并复测 0–4 全过；并发冲突 ✅（明确提示+不覆盖）；MCP 双设备隔离 ✅（Air 旧版 server 根因已修复并撤销验证）；55 卡备份 + 隔离恢复全绿；收口材料最终版已修订待转交。
- 云端项目 yacgnikzvutbpoqvokth，当前 54 张（53 真实 + 1 保留无码测试卡）；调取码 6 枚唯一；MCP 令牌中 MacBook Air 已撤销。
- Docker 容器 prompt-manager-prompt-manager-1 占 0.0.0.0:3100 运行中；统一访问 http://192.168.31.60:3100（勿用 localhost/.local）；禁止 ./dev-server.sh start。
- Migration 20260901163555 未发布（平台仓库 HEAD efddca5 已建但未 link/未重放）；data/store.json、/api/sync、SSE 保留。
- Git：本地 bb32e42 已推为 origin/mcp-delivery；origin/master 含另一工作线 7 提交待整合；今日改动（connect 修复 + 文档）未 commit，要不要提交由用户决定。
- QA Chrome 仍开着（/tmp/qa-bug11-chrome CDP 9223）可随手关；容器 legacy 测试卡无害可留。

下一步严格按序（等用户指令再动手）：
1. 收口材料转交：用户把 docs/review/共享Supabase数据库接入收口材料-2026-09-02.md 原样转交共享 Supabase 数据库审核人（同机直接给路径），等裁定（APPROVED_FOR_EXECUTION / CHANGES_REQUIRED / BLOCKED）。
2. 按裁定行动：若放行，Migration 发布仍走门禁（平台仓库 commit/link、隔离重放、备份确认、唯一发布人）；若 CHANGES_REQUIRED 按意见整改重提；若 BLOCKED 停下等指示。
3. 开发待办（可与 1 并行，需用户启动）：写队列停摆修复（20s 延迟+冲突风暴后重试链死亡，建议单项超时+自愈）；连字符调取码规则（产品评估避开 -）。
4. git 分叉整合（需用户明确授权）：先处理未提交工作树，再合并 origin/master；Air 克隆现停 mcp-delivery。
5. 小项：遗留无码测试卡按用户决定清理；关 QA Chrome；scratch 临时脚本可留。

硬性禁区：
- 不自行宣布收口、批准发布、supabase db push、改 Dashboard/SQL Editor、接入新数据库功能。
- 未经用户明确授权，不 commit/push、改 Services、重建容器、动 DockerData/DockerBackups/Named Volume。
- 不删/停用 data/store.json、/api/sync、SSE；不把 HTTP 200/构建/Lint/Docker Up 当多端验收。
- 不泄露 AI Key、MCP 令牌、数据库密码、Auth token、真实提示词正文；备份/.env* 不进 Git；REST/RPC 带 Accept-Profile: prompt_manager。
- 先 git status，绝不 reset/checkout/覆盖/删除用户改动。
```

## 16.18 阶段八次收束（2026-09-03，收口审查裁定 APPROVED_FOR_EXECUTION + Migration 已发布；**已被 §16.19 取代，降级为历史记录**）

> 本节取代 §16.17 成为当前唯一有效入口；更早小节仅作历史记录。管理员 14:46–15:00 独立核验 + 裁定已给出，项目侧已按裁定完成材料回填与唯一发布人登记。

### 1. 当前工作进展

**A. 审查裁定（2026-09-03 15:00，数据库管理员）**：
- 结论：**APPROVED_FOR_EXECUTION** — 数据库接入收口放行（L0–L5 采信）；`20260901163555` 批准发布；§7 五项逐项裁定。
- 管理员核验（§一，9 项）：`20260901163555` 1,732 B SHA 一致 + 语义（`#variable_conflict use_column` + 全程 owner 过滤 + 固定 search_path + 无动态 SQL）+ 平台 HEAD `efddca5` 已超前于材料 + 已 `supabase link`（`project-ref`/`linked-project.json` 在位）+ habit_tracker `20260903141849` SHA 一致 + **全新 PG16 隔离重放 3 份 Migration 零错误**（材料 §6.10 未完成项由管理员代执行）+ RPC/RLS 冒烟一致（有效令牌 1 行/copy_count+1/revision+1，无效 0 行，大小写归一）。
- 载体：`/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/项目审查丨prompt_manager/收口审查裁定丨prompt_manager丨2026-09-03.md`；转送清单：`.../转送文件清单丨prompt_manager.md`（6 项待办按优先级）。
- 五项裁定：① SECURITY DEFINER 接受（2 WARN 预期存档，未来改函数须重审）；② `20260901163555` 批准发布；③ 收口放行；④ 旧链路要求限期退场（不同意长期维持，独立变更申请）；⑤ 授权补传追认合规（一次性，不得常规化）。

**B. 项目侧已闭环（裁定后）**：
| 事项 | 状态 | 证据 |
|---|---|---|
| 收口材料回填 PM-2 | ✅ | `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 新增 §9（15:00 后状态更新表，引用裁定 §一）+ §10（发布后状态） |
| Migration 发布 #6 | ✅ | `supabase db push --dry-run --include-all` 预检仅 1 份 → 正式 `--include-all` `Applying migration 20260901163555… Finished` → `migration list` Local 4 = Remote 4（`20260901152616`/`20260901152750`/`20260901163555`/`20260903141849`）对齐；幂等补录无行为变化 |
| 平台仓库 Git/link | ✅ | HEAD `efddca5` + 已 link（`supabase/.temp/*` 在位）；本次仅登记，未新增代码 |
| PLAN/CURRENT_STAGE/AGENTS 对齐 | ✅ | PLAN 标题 + 事实段 + 步骤标记 + 2026-09-03 裁定后状态已更新；CURRENT_STAGE 重写为 2026-09-03 快照；AGENTS 技术栈/进展已对齐 Supabase+Docker |

**C. 验收与交付总览（保持 §16.17 结论，本轮仅增量）**：
- BUG-11/connect 四项修复闭环、并发冲突、MCP 双设备隔离、BUG-9/10 复测、55 卡备份演练 均 ✅（`docs/qa/BUGS.md`）。
- 云端：54 张（53 真实 + 1 保留无码卡）；6 码唯一；MCP 令牌总数 10（含撤销，活跃 2）；Docker `prompt-manager-prompt-manager-1` Up；`http://192.168.31.60:3100`。

**D. 剩余待办（按转送清单优先级，裁定 §四 不在批准范围）**：
| # | 优先级 | 事项 | 状态 |
|---|---|---|---|
| 1 | P1 | 写队列停摆修复（单项超时+自愈，冲突回归）PM-3 | ✅ 已修复并部署（`503cf86`，容器已重建、线上 bundle 含修复标识）；**冲突回归按用户决定搁置——用户长期只用 Mini 单设备，不做双设备测试，后续会话不得再要求**；状态如实标注「已部署、未做冲突回归」，不标通过 |
| 3 | P2 | legacy `/api/sync` 退场独立变更申请（裁定要求限期） | 📄 草稿已建待管理员审批：`docs/review/独立变更申请丨legacy-sync退场丨prompt_manager丨2026-09-03.md`（方案 A 先收写缓退役 + 影响面/回滚/验收齐备；批准前不实施） |
| 4 | P2 | ~~平台仓库 remote/备份~~ **已完成**（2026-09-03 治理侧销项：私有远端 `wanghoufan/alw-db-governance`，本地与远端同步于 `cbbd123`，Migration 5/5 已推） | ✅ 已完成 |
| 4 | P3 | 连字符调取码规则（PM-4） | ⏳ 产品评估 |
| — | — | ~~git 分叉整合~~ **已完成**（2026-09-03 核验：本地 master `6144cae` 已合并 origin/master，收尾提交 `73bf618`，双端同点；遗留仅未跟踪 `supabase/`（CLI link 临时文件 + .DS_Store），待用户决定加入 .gitignore 或删除） | ✅ 已完成 |

### 2. 下一步任务（严格按序）

1. ~~**P1 写队列修复**~~：已修复并部署（`503cf86`，静态门禁全绿，容器重建、线上 bundle 含修复标识）；冲突回归按用户决定搁置（用户长期只用 Mini 单设备，不做双设备测试，后续会话不得再要求），状态如实标注「已部署、未做冲突回归」。
2. **P2 legacy 退场申请**：评估 `/api/sync` 收缩为只读或直接退役的独立变更申请（保留 SSE 只读可缓办），提交审核人。
3. ~~**P2 平台远端备份**~~：已完成（治理侧 2026-09-03 销项 PM-1：私有远端 `alw-db-governance` 已配置并同步）。
4. **P3 连字符调取码**：产品二选一（改规则避开 `-` 或在 MCP 工具描述明确精确传参）。
5. ~~**git 分叉整合**~~：已完成（master `6144cae` = origin/master，收尾提交 `73bf618`）；剩小项：`supabase/` 未跟踪目录（CLI link 临时文件）由用户决定 gitignore 或删除。
6. **小项**：保留无码测试卡按决定清理；关 QA Chrome；scratch 脚本可留。
7. **发布归档**：管理员将按惯例核对线上状态后收口归档；项目侧无需重复发布。

### 3. 注意事项与相关规矩（接续前必读）

1. **角色边界**：接续者是项目接入智能体，不是数据库审核人；不自行扩散 SECURITY DEFINER 模式到其他操作，改函数须重审。
2. **发布已闭环**：`20260901163555` 仅登记补录，无线上行为变化；严禁以此为由扩散新 Migration，未经报审不得新增结构/权限。
3. **运行时禁区**：3100 被 Docker 占用，绝不 `./dev-server.sh start`；不改 Services/DockerData/Backups/Named Volume 除非用户授权。
4. **访问地址**：只用 `http://192.168.31.60:3100`；LAN IP 变动先停下。
5. **数据安全**：不泄露 AI Key/MCP 令牌/数据库密码/Auth token/正文；备份/.env* 不进 Git；Management API 绕过 RLS 不得常规化。
6. **兼容链路限期**：旧链路不再是“长期保留”，须限期提交退场申请；在此之前仍不删/停用。
7. **验证口径**：只认三件套；HTTP 200/构建不算云端持久化。
8. **Git**：先 `git status`；未授权不 commit/push/reset；平台仓库已有私有远端 `alw-db-governance`（PM-1 已销项）。
9. **文档归属**：裁定与转送清单在平台审查目录；项目侧 QA→`docs/qa/BUGS.md`、收口材料→`docs/review/…-2026-09-02.md`、交接→`docs/handoff/HANDOFF.md`（§16.18 唯一入口）。
10. **遗留**：今日改动未 commit、QA Chrome 可关、legacy 测试卡可留 — 均不阻塞收口。

### 4. 下一个智能体接续恢复提示词（一键复制）

```text
【恢复 Prompt Manager｜裁定已放行 + 剩余待办按优先级】

你是「项目接入智能体」，不是共享 Supabase 数据库审核人。数据库治理侧已 APPROVED_FOR_EXECUTION（2026-09-03 15:00 裁定），Migration 20260901163555 已补录发布（Local/Remote 4/4），收口材料已回填 §9/§10。

项目目录：
/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0

开始前按顺序阅读：
1. AGENTS.md（已对齐 Supabase+Docker，当前阶段为裁定后）
2. docs/handoff/HANDOFF.md —— §16.18 是当前唯一有效入口
3. docs/review/共享Supabase数据库接入收口材料-2026-09-02.md（§9/§10 为裁定后回填，4/4 Migration 已发布）
4. docs/qa/BUGS.md
5. /Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/项目审查丨prompt_manager/收口审查裁定丨prompt_manager丨2026-09-03.md（裁定 §一 9 项核验 + §三 5 项裁定）
6. /Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/项目审查丨prompt_manager/转送文件清单丨prompt_manager.md（6 项待办按优先级）
7. docs/pm/PLAN.md、docs/progress/CURRENT_STAGE.md（已更新至 2026-09-03）

当前事实（已验证）：
- 裁定放行 L0–L5，SECURITY DEFINER 接受（2 WARN 存档），旧链路要求限期退场，补传追认合规。
- 平台仓库 HEAD efddca5，已 link，隔离重放零错误（管理员代执行），migration list 4/4。
- 云端 54 张（53+1 保留）、6 码唯一、MCP 总数 10；Docker Up 0.0.0.0:3100；http://192.168.31.60:3100
- Git：本地 bb32e42 已推 origin/mcp-delivery；origin/master 7 提交待整合；今日改动未 commit。

下一步按优先级（需用户启动）：
1. P1 写队列停摆修复（单项超时+自愈，冲突回归）— 最高优
2. P2 legacy /api/sync 退场独立变更申请——草稿已建：`docs/review/独立变更申请丨legacy-sync退场丨prompt_manager丨2026-09-03.md`，待用户转送管理员审批；批准前不实施
3. ~~P2 平台仓库 remote/备份~~ 已完成（治理侧销项 PM-1：私有远端 alw-db-governance 已同步）
4. P3 连字符调取码规则
5. ~~git 分叉整合~~ 已完成（master 6144cae = origin/master，be1600d/450b62c 收尾已推）
6. 管理员将核对线上后归档，无需重复发布。

硬性禁区：
- 不自行新增 Migration/改 SECURITY DEFINER/改 Dashboard；改函数须重审；Management API 不得常规化。
- 未经授权不 commit/push、改 Services/DockerData/Backups/Named Volume、删旧链路。
- 不泄露 Key/令牌/正文；备份/.env* 不进 Git。
```


## 16.19 阶段九次收束（2026-09-04，用户指示「开发先到这里暂时结束」；**当前唯一有效入口**）

> 本节取代 §16.18 成为当前唯一有效入口；更早小节仅作历史记录。上轮会话完成 P1 部署收尾、P2 退场申请草稿、BUG-12 排查与修复。

### 1. 当前工作进展

| 事项 | 状态 | 说明 |
|---|---|---|
| P1 写队列停摆修复（PM-3） | ✅ 已部署 | `503cf86` 30s 单项超时+自愈重试；容器已重建、线上 bundle 含 `cloud-write-timeout` 标识；**冲突回归按用户决定永久搁置**（不标通过） |
| HANDOFF 待办核销 | ✅ | git 分叉整合早已完成（`6144cae`）；`/supabase/` 已入 `.gitignore`（`450b62c`）；P2 平台仓库备份治理侧已销项（远端 `alw-db-governance`） |
| P2 legacy `/api/sync` 退场独立变更申请 | 📄 草稿待审批 | `docs/review/独立变更申请丨legacy-sync退场丨prompt_manager丨2026-09-03.md`（方案 A 先收写缓退役 + 影响面/回滚/验收）；**管理员批准前不实施**；待用户转送 |
| **BUG-12 数据丢失事故**（2026-09-03 用户报告） | 🔧 修复已提交，**待部署** | 用户新建/生成卡片保存标题标签后刷新丢失。根因（QA 两轮现场证据 + store.json/localStorage 核验）：云端写静默失败期间编辑仅落 localStorage → 会话掉为未登录 → legacy 快照**无条件覆盖** localStorage，数据三方皆失、**无法恢复**（用户当天数据确认全灭）。修复 `5c2359c`（已推 master）：①`backupLocalSnapshot()` 任何远端快照覆盖前滚动备份四组 localStorage 到 `prompt-manager:preconnect-backup`；②`mergeLocalOnlyIntoRemoteSnapshot()` 仅存本机实体按 id 合并回视图并补推送 + toast。tsc/ESLint/build 三门禁全过。详见 BUGS.md「BUG-12」与 `docs/qa/2026-09-03 丨 保存丢失排查-Mini端QA现场证据 丨 V1.0.md` |
| 云端/容器现状 | ✅ | 云端 54 卡权威；容器 Up、0.0.0.0:3100；legacy store.json 55 张（多 1 张 QA 测试卡）+ localStorage 同步，**均属 legacy 侧，不影响云端** |

### 2. 下一步任务（按序，需用户启动）

1. **BUG-12 部署**（待用户授权）：同步 `src/app/page.tsx` + `src/lib/storage.ts` 到 `Services/prompt-manager` → `docker compose --env-file .env.local build && up -d` → 验证 HTTP 200 + bundle 含修复（容器内 grep `preconnect-backup` 或 `mergeLocalOnly`）。
2. **部署后用户操作（顺序不可反）**：①登录前在 Mini UI 删除 legacy 独有测试卡「QA保存测试-0903b」「BUG11 复测占位卡」及「qa测试」标签（否则重新登录时会被合并进云端）；②点「云端登录」重新登录（会话已掉，Google OAuth）；③确认底栏为「已开启 Supabase 云端实时同步」。
3. **P2 legacy 退场**：等管理员批准申请草稿后按其 §7 流程实施；若管理员先批准，先于用户登录前实施也可一并消除 legacy 测试卡顾虑。
4. **P3 连字符调取码**：产品二选一（改规则避开 `-` 或 MCP 描述明确精确传参），不急。
5. **会话掉登录根因监控**：BUG-12 的「为何掉登录」无法事后定位；若再次发生，第一时间抓 Supabase Auth 网络请求（`/auth/v1/token?grant_type=refresh_token` 的状态码），不得凭猜测下结论。

### 3. 注意事项及相关规矩

- **用户长期只用 Mini 单设备，不做、也不再被建议做双设备冲突回归**；任何会话不得以验收理由要求第二台设备。
- Mini 使用铁律：重要新增保存后看一眼；**每次打开页面先看底栏**——不是「已开启 Supabase 云端实时同步」文案就不要做重要编辑。
- 数据找回兜底：localStorage 出现意外覆盖时查 `prompt-manager:preconnect-backup` 键。
- 未经用户明确授权：不 commit/push、不改 Services、不重建容器、不动 DockerData/DockerBackups/Named Volume。
- 数据库红线不变：不 `db push`、不改 Dashboard/SECURITY DEFINER、不查改生产数据；legacy `/api/sync`、`data/store.json`、SSE 在退场批准前保留不删。
- 不泄露任何 Key/令牌/数据库密码/Auth token/真实提示词正文；QA 报告只允许标题与 id。
- 收口材料正文只在 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`；BUG 记录只在 `docs/qa/BUGS.md`；不新建重复文档。
- 动手前先 `git status`；绝不 reset/checkout/覆盖/删除用户改动。
