# 共享 Supabase 项目与独立 Schema 数据库规范

> 版本：V1.1  
> 日期：2026-09-02  
> 状态：当前生效。V1.0 保留为原始决策记录，本文件是后续接入的执行依据。  
> 适用范围：个人维护的 Web 工具、小网站、Dashboard、桌面工具和内部系统。  
> 核心决定：**一个共享 Supabase 项目；一个工具一个独立 Schema；共享数据库结构只由【平台丨共享 Supabase 数据库】管理；浏览器权限由 Auth + RLS 限制；多端按记录同步，不做整库覆盖。**

---

## 1. 目的与适用方式

本规范解决两个问题：

1. 多个个人工具如何安全共用同一个 Supabase 项目。
2. 让 AI 在新项目接入时有一条可检查、可发布、可恢复的固定路径，而不是每次临时决定权限和数据库结构。

它不是“给一个项目配一次数据库”的说明书，而是共享项目的长期管理规则。新工具接入前应先读本文件，再提出数据库方案；数据库方案通过后才允许建表或改权限。

本规范不要求为每个个人工具创建独立 Supabase 项目。独立项目只在需要独立故障边界、高风险迁移演练、敏感数据隔离或恢复演练时启用。

## 2. 当前架构与边界

### 2.1 一个共享项目，多个独立 Schema

```text
共享 Supabase 项目
├── prompt_manager       提示词管理器
├── habit_tracker        个人打卡小工具（未来示例）
├── other_tool           其他工具
└── platform             仅真正跨工具共享的基础对象
```

规则：

- 每个工具拥有一个稳定、小写蛇形命名的 Schema，例如 `habit_tracker`。
- 业务表默认不放 `public`。
- 工具代码必须显式指定 Schema，例如 `supabase.schema('habit_tracker')`。
- 工具 A 不得直接读写工具 B 的 Schema；需要共享能力时，先评估是否应进入 `platform`，并做高风险变更审查。
- 不修改 `auth`、`storage`、`realtime` 等 Supabase 系统 Schema。

### 2.2 四层解耦

```text
Code     应用源码、数据库 Migration、类型、部署模板
Config   .env 文件、URL、publishable key、服务端密钥
Data     Supabase PostgreSQL、Supabase Storage、业务数据
Runtime  本机、Docker、Mac Mini、VPS、Vercel、Netlify
```

真实数据不依赖浏览器缓存、应用目录、容器可写层或某一台电脑。Migration 属于代码，应进入 Git；真实业务数据、备份和密钥不进入 Git。

### 2.3 云端主数据源与本机兼容层

对已经接入 Supabase 的工具，登录成功后的 Supabase 是唯一云端主数据源。

```text
已登录 + 云端可用
→ 读写该工具 Schema

未登录、首次迁移前或云端暂不可用
→ 仅使用本机兼容数据/缓存
```

本机 `localStorage`、旧 JSON 文件、旧 SSE 或旧 API 可以在迁移阶段继续作为兼容层，但必须遵守：

- 不得把本机整份快照自动覆盖回云端。
- 云端恢复后，不得自动执行双向“全量合并”。导入或恢复必须由用户明确确认。
- 本机敏感偏好（例如仅本机使用的 API Key）不得因为“同步方便”而进入云端。
- 旧链路何时下线，必须由每个工具在完成跨设备验收后单独决定。

## 3. 共享平台仓库与职责分工

共享数据库结构的唯一权威来源是：

```text
【平台丨共享 Supabase 数据库】
└── supabase/migrations/
```

职责划分：

| 位置 | 负责内容 |
|---|---|
| 共享平台仓库 | Schema、表、约束、索引、RLS、Policy、Function、Trigger、Realtime publication、数据库目录、Migration |
| 业务工具仓库 | UI、Repository/Service、Supabase 客户端、类型映射、导入/导出、业务测试 |
| Supabase Dashboard | 查看状态、Auth/URL 等全局配置、紧急诊断；不能成为未记录结构变更的唯一来源 |

业务项目不得自行维护另一套同一共享项目的 Migration 历史。多个 Agent 或多台电脑也不得同时对生产项目执行数据库发布。

## 4. 新工具接入的固定流程

以个人打卡小工具为例，AI 必须按以下顺序工作：

1. **登记**：说明工具名、计划使用的 Schema（例如 `habit_tracker`）、数据敏感度、是否需 Auth、Realtime、Storage、离线能力和恢复要求。
2. **先给设计，再改数据库**：列出表、字段、主键、外键、唯一约束、删除策略、数据归属字段、RLS、冲突规则和 Realtime 表。
3. **在共享平台仓库创建 Migration**：使用 Supabase CLI 生成 Migration 文件；不要手写时间戳，也不要直接把生产 Dashboard 当作结构来源。
4. **发布前验证**：检查目标项目、目标 Schema、SQL 影响范围、RLS、grants、备份和回滚方案。
5. **唯一发布**：同一时间只允许一个发布人或一个 CI 流程执行生产发布。
6. **业务项目接入**：业务代码通过 Repository/Service 集中访问自己的 Schema；浏览器端不散落任意 Supabase 查询。
7. **验收后启用**：完成权限、双设备、断线重连和恢复路径验证后，才把云端作为正式同步源。

如果工具没有明确回答上述内容，不允许直接开始建表。

## 5. 数据模型与数据归属

### 5.1 基础字段

业务表至少考虑：

```sql
id uuid primary key default gen_random_uuid(),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

有登录数据的表必须包含稳定归属字段，通常为：

```sql
owner_user_id uuid not null references auth.users(id)
```

多人/共享空间工具再根据需要加入 `workspace_id`。不能用前端传入的用户 ID 或 `user_metadata` 作为授权依据。

### 5.2 约束、关联与索引

- UUID 适合跨设备、离线先创建记录的个人工具。
- 外键、复合唯一约束和 `CHECK` 约束优先于只靠前端约定。
- 每个外键和高频筛选字段都评估索引；不要为了“看起来完整”给低数据量表盲目加索引。
- 多对多关系使用独立关系表和复合主键/唯一约束。
- 关系表必须记录或可验证其 `owner_user_id` 与两端实体一致，不能允许用户把自己的关系连到别人的实体。
- JSONB 只用于不稳定扩展字段；需要查询、筛选或排序的核心数据使用独立列。

## 6. Data API、Auth、GRANT 与 RLS

### 6.1 自定义 Schema 的“三道门”

浏览器要访问 `habit_tracker` 这类自定义 Schema，必须同时确认：

1. **Expose**：该 Schema 已在 Supabase Data API 的 Exposed schemas 中显式暴露。
2. **GRANT**：`anon` / `authenticated` 对 Schema、表、序列或函数拥有最低限度的对象访问权。
3. **RLS**：每张暴露表启用 RLS，Policy 决定调用者实际能读取和修改哪些行。

Expose 或 GRANT 缺失时，功能会报“无权限”或无法访问；RLS 缺失或错误时，则可能发生越权。对象权限不等于行级权限，两者必须一起审查。

### 6.2 RLS 固定规则

所有暴露给 Data API 的业务表必须启用 RLS。用户私有数据的 Policy 至少满足：

```sql
-- SELECT：只能读自己的行
using ((select auth.uid()) = owner_user_id)

-- INSERT：只能创建归属自己的行
with check ((select auth.uid()) = owner_user_id)

-- UPDATE：同时限制旧行和新行归属
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id)
```

注意：UPDATE 没有 SELECT Policy 时，可能表现为更新 0 行而非明显报错；UPDATE 也必须同时有 `USING` 和 `WITH CHECK`。不要只写 `to authenticated`，那只代表“已登录”，不代表“拥有这条数据”。

### 6.3 Auth 是共享项目的全局配置

Magic Link、OAuth Provider、Site URL、Redirect URL 白名单、邮件模板、SMTP、会话策略都可能影响共享项目里的多个工具。因此：

- 新工具先复用现有 Auth，再提出新增 Provider 或全局配置改动。
- 修改 URL 配置前列出受影响工具的本地地址、正式地址和回调地址。
- 先使用 Supabase 默认邮件模板时，不把“自定义 SMTP”当成登录成功的前置条件。
- 登录异常先检查 Auth 日志、Site URL、Redirect URL 和浏览器会话，再修改业务代码。

## 7. 密钥、服务端权限与 MCP

### 7.1 环境变量规则

浏览器可使用：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`NEXT_PUBLIC_*` 会进入浏览器，只能放 URL 和 publishable key。以下内容绝不进入浏览器、Git、日志、截图或示例：

```text
service_role / secret key
数据库密码与连接串密码
用户 API Key
MCP 原始访问令牌
```

单一共享 Supabase 项目不等于所有运行环境必须有不同数据库。个人工具默认可以连接同一个共享项目；`.env.local`、部署环境变量和 `.env.example` 的作用是区分运行位置与保存方式，而不是擅自制造多套数据库。

### 7.2 MCP 能力令牌

MCP 不是浏览器 Auth 会话的替代品。需要让本机 MCP 访问私有数据时：

- 每台设备生成一枚独立、随机、可撤销的令牌。
- 数据库只保存令牌哈希，原始令牌只在创建时展示一次，并放在该设备的私有 `.env.local`。
- 支持查看标签、创建时间、最后使用时间和撤销状态；不回显令牌。
- MCP 不读取另一台设备的本地 JSON，不使用 `service_role`，也不持有数据库密码。
- 调取、计数等带副作用操作必须由数据库原子函数完成，不能先读取再在客户端猜测结果。

### 7.3 数据库 Function 的高权限例外

默认使用 `SECURITY INVOKER`。`SECURITY DEFINER` 仅在 RLS 无法完成、且有明确最小权限设计时允许，例如受限 MCP 能力令牌的原子读取/计数。

使用该例外前必须同时满足：

- Function 放在工具自己的 Schema，不放入 `public`。
- 固定并收紧 `search_path`，函数内所有对象使用明确 Schema。
- 不使用动态 SQL；输入做长度、格式和归属校验。
- 令牌只能映射到自身所有者；返回字段只包含该能力确有必要的数据。
- 先撤销默认 `PUBLIC` 执行权，再只授予实际需要的角色；若必须允许 `anon` 调用，必须把高熵令牌校验、可撤销性、速率/审计和安全顾问告警结论写入审查记录。
- 发布前完成 Function 的成功、未授权、已撤销令牌、跨用户数据和并发副作用测试。

`SECURITY DEFINER` 的安全顾问提示不能被“忽略”；必须明确记录它为何存在、谁能调用、如何限制和何时复查。

## 8. Migration、紧急修复与发布

### 8.1 正常发布路径

```text
设计审阅
  → 共享平台仓库创建 Migration
  → SQL / RLS / Function 审查
  → 本地或隔离环境验证
  → 备份确认
  → 唯一发布人发布
  → migration 状态、RLS、功能和 Advisors 复核
```

发布前必须确认：Supabase 项目引用正确、目标 Schema 正确、没有触及其他工具 Schema、Migration 顺序正确、回滚或恢复方案可执行。

### 8.2 生产紧急修复的回写规则

紧急情况下可以在 Dashboard SQL Editor 或受控 SQL 工具中直接修复生产问题，但这不是常规发布方式。发生后必须：

1. 记录实际执行的 SQL、时间、目标项目和原因。
2. 在共享平台仓库创建或补齐内容完全一致的 Migration。
3. 在隔离环境复核该 Migration 能重放。
4. 在 Migration 与生产状态重新一致前，暂停该 Schema 的后续数据库发布。
5. 把异常、验证结果和是否有数据副作用记入变更记录。

这样可避免“生产已经修好，但 Git 没有历史，下一次发布又覆盖或重复修复”的问题。

### 8.3 禁止事项

- 多个 Agent 或多台电脑同时对生产执行 `db push`。
- 未确认项目和 Schema 就执行 SQL。
- 使用 `drop schema ... cascade` 或未备份的破坏性 SQL。
- 把生产数据写入 `seed.sql`，或把备份、`.env`、令牌提交 Git。
- 只在 Dashboard 改表、改 Policy 或改 Function 后不回写 Migration。

## 9. 多端同步、并发与 Realtime

### 9.1 记录级写入

禁止下列模式：

```text
读出全部数据 → 改一条 → 把全部数据整份写回
```

改用：

```text
新增实体       INSERT 一行
更新实体       条件 UPDATE 一行
删除实体       DELETE 或软删除一行
关系变化       单独 INSERT / DELETE 关系行
版本历史       仅追加 INSERT
统计值         数据库原子更新
```

核心可编辑实体应具备 `updated_at` 与 `revision`。更新时携带读取时的 revision；若条件更新返回 0 行，代表产生冲突，客户端必须刷新最新记录并明确处理，不能静默覆盖。

标签等关系变化应优先“先新增、后删除”，避免网络中断时短暂丢失全部关系。版本历史只追加，不先删后写。

### 9.2 Realtime 的正确职责

Realtime 是“有变化了”的通知，不是自动冲突合并，也不是可靠历史回放。每个需要同步的表必须：

- 显式加入 `supabase_realtime` publication。
- 订阅自己的 Schema、表和事件。
- 初始加载主动查询；重连后再次主动查询。
- 在本机写入队列尚未完成时，避免用 Realtime 回声覆盖正在保存的本地状态。
- 验证 RLS 既允许合法用户收到自己的事件，也不会泄露其他用户的数据。

## 10. 验收与发布门禁

任何新 Schema、RLS、Auth、Function、Realtime 或 Storage 变更，至少完成以下检查：

### 10.1 结构与迁移

- [ ] Schema 与工具归属清楚，未触及其他工具。
- [ ] Migration 位于共享平台仓库，可追溯、可重放。
- [ ] 主键、外键、唯一约束、删除策略和必要索引已验证。
- [ ] 紧急修复若存在，已回写为 Migration。

### 10.2 权限与密钥

- [ ] 自定义 Schema 的 Expose、GRANT、RLS 三道门全部验证。
- [ ] 未登录、另一用户、伪造 owner_user_id 的读取/插入/更新/删除均被拒绝。
- [ ] UPDATE 不允许改变数据归属。
- [ ] 浏览器包、日志和示例中没有 secret/service role/MCP 原始令牌。
- [ ] Function 权限和 Security Advisor 结果已审查。

### 10.3 多端与故障

- [ ] 两台已登录设备分别完成 INSERT、UPDATE、DELETE，并互相看到结果。
- [ ] 同时修改同一记录时，得到明确冲突结果，没有静默丢失。
- [ ] 关系变更、版本历史和原子计数符合预期。
- [ ] 断网、重连、刷新后会重新读取云端状态。
- [ ] 本机兼容层不会自动全量覆盖云端。

### 10.4 恢复

- [ ] 已有数据库逻辑备份/平台导出，Storage 工具另有文件备份。
- [ ] 备份不在 Git，且至少有不同位置的一份副本。
- [ ] 已记录恢复步骤，并在隔离环境或 Sandbox 做过恢复演练。

## 11. 变更分级

| 变更 | 等级 | 最低要求 |
|---|---:|---|
| 自己 Schema 新增可兼容表/字段 | 低 | Migration + 结构验证 |
| 索引、非敏感查询优化 | 中 | Migration + 性能/回归验证 |
| Realtime publication | 中 | 双设备验证 + 额度评估 |
| 字段重命名、类型变更、数据迁移 | 高 | 兼容期、备份、回滚/恢复方案 |
| RLS、GRANT、Expose、Function 执行权限 | 高 | 越权测试 + 安全审查 |
| Auth URL、Provider、邮件/会话全局配置 | 高 | 所有接入工具影响评估 |
| `platform` Schema 改动 | 高 | 所有依赖工具评估 |
| `SECURITY DEFINER` 或允许 anon 调用的能力函数 | 极高 | 专项威胁审查、令牌/审计/撤销验证 |
| 删除表、字段、Schema 或批量改写数据 | 极高 | 人工批准、导出、恢复演练、可执行回退方案 |

## 12. 给 AI 的固定接入提示

以后让 AI 为新工具接入共享 Supabase 时，附上以下要求：

> 本工具接入共享 Supabase 项目，必须创建并仅使用独立的 `<tool_schema>` Schema。先说明 Schema、表、归属字段、RLS、Data API Expose/GRANT、Realtime、冲突处理、备份和回滚方案，待确认后再写 Migration。所有数据库结构、Policy、Function、Trigger 和 publication 只能由【平台丨共享 Supabase 数据库】仓库的 `supabase/migrations` 管理。禁止使用其他工具 Schema、禁止把业务表放 `public`、禁止整库 JSON 快照覆盖、禁止在浏览器暴露 secret/service role、禁止用 user_metadata 授权。浏览器只使用 publishable key；所有暴露表必须启用按 `auth.uid()` 归属限制的 RLS。若要使用 MCP 或 `SECURITY DEFINER` Function，必须单独说明调用者、令牌、撤销、最小返回字段、执行权限和安全验证。完成后必须验证 Migration、RLS 越权、双设备 CRUD、断线重连和恢复路径。

AI 在实施前必须回答：

1. 新工具的 Schema 是什么，为什么不与现有 Schema 混用？
2. 需要哪些表、关联、唯一约束和索引？
3. 哪些对象需 Expose，哪些角色需要哪些 GRANT？
4. 每张表的 owner/workspace 归属字段和 RLS 的 SELECT/INSERT/UPDATE/DELETE 规则是什么？
5. Auth、Redirect URL 或邮件配置是否会影响现有工具？
6. 哪些表要加入 Realtime，断线后怎样补读？
7. 同一记录并发编辑、关系并发变化和离线恢复如何处理？
8. Migration 在哪里创建，谁发布，如何验证和恢复？
9. 是否需要 Function、MCP 或 Storage；若需要，为什么不能用普通 RLS？

## 13. 当前落地基线与待完成项

### 13.1 已落地的提示词管理器基线

- 使用独立 `prompt_manager` Schema，不使用 `public` 保存业务数据。
- 已接入 Supabase Auth、RLS、Data API 自定义 Schema 暴露和 Realtime。
- 卡片、标签、设置采用记录级读写和 revision；标签关系增量同步，版本历史追加。
- 浏览器只使用 publishable key；`aiApiKey` 保留本机，不进入云端。
- MCP 使用每设备可撤销令牌和令牌哈希，通过受限 RPC 完成云端调取与原子复制计数，不使用 service role。

### 13.2 仍需按本规范收口的事项

- 将已经在线上即时修复的 MCP RPC 函数变更补写入共享平台仓库的正式 Migration，恢复“Git 与生产同源”。
- 完成真实 Mac 与另一台设备的双向 CRUD、冲突、断线重连和 MCP 验收；在此之前，旧本机 JSON/SSE 兼容层不得被误认为正式跨设备同步方案。

## 14. V1.1 相对 V1.0 的修订摘要

- 明确“同一共享项目”下，云端主数据源与本机兼容层的优先级和禁止自动覆盖规则。
- 将自定义 Schema 的 Expose、GRANT、RLS 组合为必须逐项验证的三道门。
- 将 Auth URL、邮件和会话配置列为可能影响所有工具的高风险全局变更。
- 新增 MCP 能力令牌与 `SECURITY DEFINER` 的例外安全规则。
- 新增生产紧急修复必须回写 Migration、再继续发布的恢复机制。
- 根据实际提示词管理器接入，细化记录级 revision、标签关系、版本历史、写入队列和 Realtime 回声处理要求。
- 将双设备 CRUD、越权、Advisors、备份和恢复提升为发布门禁，而非仅建议。

## 15. 官方参考

- [Supabase Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
