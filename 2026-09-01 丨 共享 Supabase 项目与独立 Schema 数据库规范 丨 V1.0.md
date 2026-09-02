# 共享 Supabase 项目与独立 Schema 数据库规范

> 版本：V1.0  
> 日期：2026-09-01  
> 适用范围：个人维护的多个 Web 工具、小网站、Dashboard、内部系统  
> 核心决定：**多个工具共用一个 Supabase 项目；每个工具使用独立 Schema；数据库结构通过迁移文件统一管理；权限通过 RLS 隔离。**

---

## 1. 规范目的

本规范用于统一以后所有个人工具项目的数据库设计和协作方式。

它解决：

- 多个项目是否可以共用一个 Supabase 项目。
- 不同项目的数据如何避免相互覆盖、误读和误删。
- Mac、Windows、Linux、Docker、VPS、Vercel、Netlify 如何连接同一个数据库。
- AI Agent 开发新项目时，数据库如何建表、迁移、授权和验收。
- 如何让数据库结构进入 Git，同时避免真实数据、密钥和生产备份进入 Git。
- 如何为多端修改和实时同步预留正确的数据结构。
- 如何与“代码、配置、数据、运行环境解耦”的自托管规范配合。

本文是长期数据库规范，不依赖某一个具体项目的业务数据。

## 2. 最终架构决定

### 2.1 Supabase 项目分配

对于本规范的默认个人使用场景，只使用一个 Supabase 项目：

```
shared-supabase
= 个人所有小工具共同使用的云端数据库
```

这里不存在必须区分的“开发数据库”和“测试数据库”。开发机、Mac Mini、VPS、Vercel 或 Netlify 运行的应用，只要连接同一个项目，就访问同一个个人云端数据中心。

第二个 Supabase 项目不是必需项，仅在以下情况使用：高风险迁移演练、需要用测试数据反复破坏性测试、某个工具需要独立故障边界，或作为恢复演练环境。Free 计划的项目数量和额度可能变化，实际执行前应核对 Supabase 当前页面。

独立 Schema 是默认的数据隔离方式；独立 Supabase 项目是可选的更高等级故障和权限隔离。

### 2.2 项目内部的 Schema 分配

共享项目内部采用“一工具一 Schema”：

```
shared-supabase
├── prompt_manager
├── insurance
├── health
├── rss_reader
├── book_notes
└── platform（可选，仅放真正跨工具共享的基础对象）
```

每个工具只能使用自己的 Schema：

```
prompt_manager.cards
prompt_manager.tags
insurance.policies
health.records
```

禁止把所有业务表都放在 public，也禁止让所有工具共用一张没有明确归属字段的万能表。

### 2.3 四层解耦原则

沿用《本地项目自托管与跨平台部署架构 SOP》的四层模型：

```
Code       代码
Config     配置和密钥
Data       真实数据
Runtime    运行环境
```

在本规范下：

```
Code
→ GitHub、应用源码、数据库迁移文件、类型定义、部署配置模板

Config
→ .env、环境变量、Supabase URL、publishable key、服务器 Secret

Data
→ Supabase PostgreSQL、Supabase Storage 或 S3-Compatible Object Storage

Runtime
→ 本地 Node.js、Docker、Mac Mini、VPS、Vercel、Netlify
```

代码可以重新 Clone、Build、升级；真实数据不能依赖代码目录、Container 自身文件系统或某台开发电脑的浏览器缓存。

## 3. 与现有自托管规范的兼容性

### 3.1 总体结论

两套规范没有根本冲突，新的数据库规范是对原自托管规范的数据库专项补充。

原文档负责：

- 代码、配置、数据、运行环境分离。
- GitHub 统一代码。
- 开发目录与生产目录分离。
- Docker Volume/Bind Mount 持久化。
- Secret 不进入 Git。
- 数据库地址和文件路径通过环境变量配置。
- 发布、回滚和备份边界。

本规范补充：

- 一个 Supabase 项目内的数据库边界。
- 每个工具独立 Schema。
- 迁移文件的统一归属和发布顺序。
- RLS、grants、Auth、Data API 和 Realtime。
- 云数据库与本地 Docker 数据库的关系。
- 多端并发、冲突和实时同步规则。

### 3.2 逐项判断

| 原自托管规范 | 兼容性 | Supabase 数据库补充 |
|---|---|---|
| GitHub 只管理代码，不管理真实数据 | 完全兼容 | Migration/Schema 属于代码，应进入 Git；生产数据不进入 Git |
| .env 管理密钥 | 完全兼容 | URL、publishable key、服务端 Secret 分环境配置 |
| 数据与 Runtime 解耦 | 完全兼容 | Supabase 云数据库不依赖 Docker Container 生命周期 |
| DATABASE_URL 可配置 | 兼容 | 服务端可用连接串；浏览器直连使用 Supabase Data API |
| Storage Adapter | 完全兼容 | Supabase Storage 是一个可替换 Adapter |
| 开发区/生产区分离 | 完全兼容 | 优先不同 Supabase 项目；受限时至少不同 Schema |
| Docker Named Volume | 不冲突 | 适用于本地数据库；云 Supabase 不需要生产数据库 Volume |
| GitHub Push 不等于立即上线 | 完全兼容 | Migration 也要经过测试、审核和单一发布 |
| 备份规范 | 完全兼容 | Supabase 云端仍需独立导出，不能视为天然备份 |
| 平台无关架构 | 完全兼容 | 业务层通过 Repository/Adapter 隔离 Supabase 专有实现 |

### 3.3 需要补充的配置概念

原文档中的 DATABASE_URL 主要适合服务端 PostgreSQL 连接。若浏览器直接使用 Supabase，还需要：

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

推荐：

- 服务端 Route Handler、Server Action、后台任务使用服务端 Supabase 客户端或数据库连接池。
- 浏览器端只使用 publishable key。
- Secret Key、service_role、数据库密码只放服务端。
- 任何 NEXT_PUBLIC_* 变量都会进入浏览器，不能放 Secret。

## 4. Schema 设计规范

### 4.1 命名

Schema 使用小写蛇形命名：

```
prompt_manager
book_notes
habit_tracker
```

表名和字段使用小写蛇形命名：

```
cards
card_versions
prompt_tags
created_at
updated_at
owner_user_id
workspace_id
```

约束、索引和策略使用带表名前缀的明确名称：

```
cards_pkey
cards_owner_user_id_idx
prompt_tags_prompt_id_tag_id_key
cards_owner_user_id_fkey
```

禁止使用大小写混合、中文 Schema、连字符 Schema 和含义不明的 app/data/default 命名。

### 4.2 Schema 归属

每个工具必须拥有自己的 Schema：

```
prompt_manager
├── cards
├── tags
├── prompt_tags
├── card_versions
└── settings
```

工具代码必须明确指定 Schema，不依赖默认 public：

```
supabase.schema('prompt_manager').from('cards')
```

禁止：

- 工具 A 直接读写工具 B 的 Schema。
- 把其他工具表复制后再做双向同步。
- 通过 public 的万能 JSON 表保存所有业务。
- 未经平台维护者批准修改其他工具 Schema。
- 修改 Supabase 的 auth、storage、realtime 系统 Schema。

### 4.3 public Schema

public 默认可能暴露给 Supabase Data API，不能当作无权限区域。

默认规则：

- 新工具业务表不放 public。
- public 只保留必要的兼容对象或经过审核的跨工具只读对象。
- 如果必须在 public 建表，必须启用 RLS、配置 grants 并通过审查。
- 自定义 Schema 要在 API 设置中加入 Exposed schemas，并配置 USAGE、表、序列和函数权限。
- 不需要 Data API 的内部表放在未暴露 Schema。

参考：[Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)、[Securing your API](https://supabase.com/docs/guides/api/securing-your-api)。

### 4.4 跨工具共享对象

只有真正属于平台基础设施的对象才放入保留的 platform Schema，例如：

```
platform.workspaces
platform.workspace_members
platform.audit_events
```

共享对象必须记录：

- 所有者。
- 使用它的工具。
- 字段兼容承诺。
- 修改审批人。
- 删除和迁移策略。
- RLS 策略。

## 5. 标准数据模型

### 5.1 通用字段

业务表至少考虑：

```
id
created_at
updated_at
```

有登录或多租户需求时加入：

```
owner_user_id
workspace_id
```

规则：

- 时间使用 timestamptz。
- 金额使用 numeric，不使用浮点数。
- 布尔值使用 boolean。
- 核心可查询字段使用独立列。
- JSONB 只用于结构不稳定的扩展元数据。
- 每个外键和常用筛选字段建立合理索引。

### 5.2 主键

个人跨设备工具通常推荐 UUID：

```
id uuid primary key default gen_random_uuid()
```

原因：

- 客户端离线创建记录时可以先生成 ID。
- 多设备创建时不容易碰撞。
- 不依赖某一台服务器发号。

大规模、高写入量表再评估 UUIDv7、ULID 或 bigint identity；启用扩展前先确认当前 Supabase 项目支持情况。

### 5.3 外键和唯一约束

数据库约束优先于应用层约定。

卡片-标签关系示例：

```
create table prompt_manager.prompt_tags (
  prompt_id uuid not null
    references prompt_manager.cards(id) on delete cascade,
  tag_id uuid not null
    references prompt_manager.tags(id) on delete cascade,
  primary key (prompt_id, tag_id)
);
```

关联表通常必须设置复合唯一约束或复合主键，防止重复关系。

### 5.4 用户和工作区边界

即使当前只有自己使用，也建议预留 owner_user_id 或 workspace_id。

以后支持多人时，不能相信前端传来的任意用户 ID；应通过 Auth 身份和 RLS 强制限制。

不要使用 user_metadata 作为权限依据，因为用户可以修改它。权限数据应来自数据库字段、app_metadata 或数据库关系。

## 6. RLS 与权限规范

### 6.1 所有暴露表启用 RLS

暴露给 Data API 的业务表必须：

```
alter table <schema>.<table> enable row level security;
```

需要同时理解：

- grants：角色能否访问数据库对象。
- RLS：访问时能看到或修改哪些行。

只创建 policy 不代表已有 grants 已经收紧。

参考：[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。

### 6.2 Policy 必须限制数据归属

错误模式：

```
create policy "authenticated can read"
on prompt_manager.cards
for select
to authenticated
using (true);
```

它只判断“登录了”，没有判断数据归属。

推荐模式：

```
create policy "cards_select_own"
on prompt_manager.cards
for select
to authenticated
using ((select auth.uid()) = owner_user_id);
```

UPDATE 必须同时有 USING 和 WITH CHECK：

```
create policy "cards_update_own"
on prompt_manager.cards
for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);
```

不要使用已不推荐的 auth.role() 判断角色，优先使用 policy 的 to authenticated 或 to anon。

### 6.3 单用户工具

推荐：

- 使用 Supabase Auth 登录账号。
- 业务表带 owner_user_id。
- RLS 按 auth.uid() 限制。
- 复杂或敏感写入经由服务端 Route Handler。
- 不把所有表设为匿名可读写。

### 6.4 Views、Functions 和高权限

- View 默认可能绕过 RLS；Postgres 15+ 优先考虑 security_invoker。
- SECURITY DEFINER 可能绕过调用者 RLS，应极其谨慎。
- 不要把高权限 Function 放在公开 Schema 后开放给所有角色。
- 复杂写入逻辑优先放服务端或经审查的数据库 Function。

## 7. Migration 与协作规范

### 7.1 数据库结构进入 Git

应进入 Git：

```
supabase/migrations/
supabase/seed.sql（仅测试种子数据）
数据库类型生成文件
数据库设计文档
RLS policy SQL
Realtime publication 配置
```

不得进入 Git：

```
生产真实数据
数据库密码
.env
service_role/secret key
生产备份
用户上传文件
```

### 7.2 推荐独立数据库平台仓库

多个工具共用一个 Supabase 项目时，推荐建立独立仓库：

```
shared-supabase-platform/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── docs/
│   ├── schemas/
│   │   ├── prompt_manager.md
│   │   └── insurance.md
│   └── DATABASE_CATALOG.md
├── scripts/
└── README.md
```

该仓库是共享 Supabase 项目数据库结构的唯一权威来源。

业务项目仓库负责业务代码、类型和 Repository/Service；平台数据库仓库负责 Schema、Table、Constraint、Index、RLS、Function、Trigger、Realtime publication、Seed 和数据库变更说明。

### 7.3 Migration 创建和发布

使用 Supabase CLI 创建迁移：

```
supabase migration new create_prompt_manager_schema
```

文件名由 CLI 生成：

```
supabase/migrations/<timestamp>_create_prompt_manager_schema.sql
```

标准流程：

1. 创建 Migration。
2. 写 SQL、约束、索引和 RLS。
3. 本地执行 supabase db reset。
4. 运行类型生成和测试。
5. 提交 Git 并审查。
6. 由唯一发布人执行 supabase db push。
7. 完成验证和备份。
8. 检查 supabase migration list。

如果存在第二个 Sandbox 项目，则先在 Sandbox 演练，再将同一 Migration 发布到共享项目；没有 Sandbox 时，直接在备份确认后发布到共享项目。

进入迁移工作流后，不要长期直接在生产 Dashboard 改表。远程手工变更会导致 Migration 历史与 Git 不一致。若已经手工修改，先执行：

```
supabase db pull
supabase migration list
```

参考：[Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)。

### 7.4 单一生产发布人

同一个 Supabase 项目同一时间只允许一个人或一个 CI 流程执行生产 Migration：

```
开发分支
    ↓
Migration Review
    ↓
合并主分支
    ↓
单一发布人或 CI
    ↓
supabase db push
```

不要让多个 AI Agent 或多台电脑同时对生产执行 db push。

## 8. Realtime 实时同步规范

### 8.1 Realtime 的边界

Realtime 是数据库变化通知系统，不是自动冲突合并系统。

它解决：

```
另一台设备发生 INSERT/UPDATE/DELETE，我及时收到通知。
```

它不自动解决：

```
两台设备同时修改同一行，应该保留哪一份。
```

### 8.2 初始实现

个人、小规模工具先使用 Postgres Changes：

1. 将需要监听的表加入 supabase_realtime publication。
2. 客户端订阅明确的 Schema 和 Table。
3. 收到事件后按记录 ID 更新本地状态，或重新查询受影响数据。
4. 初始加载仍然主动查询数据库。
5. 断线重连后重新拉取数据。

示例：

```
alter publication supabase_realtime
add table prompt_manager.cards;
```

Realtime 不会自动监听所有表；目标表必须加入 publication。参考：[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)。

### 8.3 Realtime 权限验证

必须同时确认：

- 表已加入 publication。
- Schema、表名和事件正确。
- 客户端有 SELECT 权限。
- RLS 允许读取变化行。
- JWT 未过期或已刷新。
- 没有超出连接数和消息额度。

规模增大或需要更复杂事件授权时，再评估 Broadcast。参考：[Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)。

## 9. 多端并发与冲突规范

### 9.1 禁止整库快照覆盖

禁止：

```
客户端读取全部数据
→ 修改一条记录
→ 把全部数据整体覆盖回数据库
```

推荐：

```
新增一条记录       → INSERT 一行
修改一条记录       → UPDATE 一行
删除一条记录       → DELETE/软删除一行
关联变化           → 单独 INSERT/DELETE 关联行
版本历史           → 单独 INSERT 版本行
```

### 9.2 记录级版本控制

核心表增加：

```
updated_at
revision/version
last_modified_by
```

更新时带客户端读取时的 revision：

```
update prompt_manager.cards
set
  title = $new_title,
  body = $new_body,
  revision = revision + 1,
  updated_at = now(),
  last_modified_by = auth.uid()
where id = $id
  and revision = $base_revision
returning *;
```

返回 0 行表示版本已变化：

```
刷新最新记录
→ 展示冲突
→ 用户选择保留、覆盖或合并
```

建议：

- 不同字段修改可以按业务规则合并。
- 不同标签关系可以按关系行合并。
- 正文同时修改默认提示冲突。
- 统计值使用数据库原子更新。
- 重要设置增加 revision。

### 9.3 UPSERT 和短事务

不要“先 SELECT 判断不存在，再 INSERT”，应使用 INSERT ... ON CONFLICT。

外部 API 调用不要放在持锁事务中；事务只包含实际数据库更新，尽量短。

## 10. 应用接入和 Storage 规范

### 10.1 访问分层

推荐：

```
UI/Route Handler
      ↓
Repository / Service
      ↓
Supabase Adapter
      ↓
Supabase Data API/Postgres
```

业务组件不要到处散落直接的 Supabase 查询。数据库访问集中在 src/lib/db、src/lib/repositories 或 src/lib/services。

### 10.2 环境变量

浏览器直连可使用：

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

服务端可使用：

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DATABASE_URL=
```

实际变量名可按框架调整，但必须：

- 开发、测试、生产分别配置。
- .env 进入 .gitignore。
- 仓库只提交 .env.example。
- Secret 不出现在 bundle、日志、截图和示例中。
- 不把生产凭据写死在代码中。

### 10.3 数据库与文件分工

结构化数据放数据库：

```
用户、配置、标签、日期、金额、文件索引、业务关系
```

PDF、图片、扫描件、视频和附件放 Storage/Object Storage；数据库只保存 bucket、path/key、mime_type、size、checksum 等索引信息。

Storage 通过 Adapter 抽象：

```
LocalStorageAdapter
SupabaseStorageAdapter
S3StorageAdapter
COS/OSS Adapter
```

文件路径推荐：

```
<tool>/<workspace_id>/<user_id>/<entity_id>/<filename>
```

Supabase Storage、S3、COS、OSS 中的生产文件只是生产副本，不等于备份。

## 11. 环境、备份和恢复

### 11.1 个人使用环境层级

```
开发机 / Mac Mini / VPS / 托管平台
→ shared-supabase 的对应工具 Schema

可选的高风险演练
→ 第二个 Sandbox 项目，或共享项目中明确命名的临时测试数据
```

对于个人低风险工具，不强制拆分数据库。默认通过独立 Schema、明确的测试数据命名和备份保护共享项目。只有在高风险迁移、敏感数据或需要独立故障边界时，才使用第二个 Supabase 项目。

### 11.2 备份

至少保留：

- Git 中的 Migration。
- PostgreSQL 逻辑备份或平台导出。
- Storage 文件备份。
- 不包含 Secret 的环境配置记录。
- 恢复步骤文档。
- 不同物理介质或不同位置的备份副本。

有 Sandbox 时优先在 Sandbox 中恢复演练；没有 Sandbox 时，应在不影响正式数据的本地 PostgreSQL 或临时环境中演练。不能只确认备份文件存在。

### 11.3 恢复前

1. 停止继续写入的应用。
2. 确认目标 Supabase 项目、Schema、表和备份时间。
3. 导出当前状态。
4. 有 Sandbox 时先在 Sandbox 演练；没有 Sandbox 时使用隔离的临时环境。
5. 再安排共享项目恢复。
6. 恢复后验证 Auth、RLS、Realtime 和应用读写。

## 12. 新工具接入流程

### Step 1：登记

记录：

```
工具名称
工具代码
Schema 名称
Git 仓库
负责人
环境
数据敏感等级
是否启用 Realtime
备份要求
```

### Step 2：创建 Schema

通过 Migration 创建：

```
create schema if not exists <tool_schema>;
```

Schema 名称必须唯一、稳定，创建后不要随意重命名。

### Step 3：设计数据模型

明确：

- 实体和字段。
- 主键。
- 外键。
- 唯一约束。
- 检查约束。
- 删除策略。
- 查询方式。
- 用户/工作区边界。
- RLS。
- Realtime。
- 冲突处理。

### Step 4：写 Migration 和业务访问层

- Migration 放共享数据库平台仓库。
- Repository/Service 放业务项目仓库。
- 不做整库快照覆盖。
- 不把 Secret 放前端。
- 生成并提交数据库类型。

### Step 5：本地和隔离环境验证

验证：

- 表、约束、索引存在。
- 非法数据被数据库拒绝。
- 正确用户只能看到自己的数据。
- 更新不能改变数据归属。
- 关联删除符合预期。
- Realtime 能收到 INSERT/UPDATE/DELETE。
- 断线重连会重新拉取。
- 并发冲突有明确结果。

### Step 6：审查和生产发布

- 完成代码审查。
- 确认没有影响其他 Schema。
- 完成备份。
- 由唯一发布人执行生产 Migration。
- 更新数据库目录、版本和恢复说明。

## 13. AI Agent 固定约束模板

以后让 AI Agent 开发需要 Supabase 的项目时，附加以下要求：

> 本项目使用共享 Supabase 项目，但必须为本工具创建独立的 <tool_schema> Schema。禁止使用其他工具的 Schema，禁止把业务表放入 public，禁止创建跨工具万能 JSON 表。所有数据库结构、约束、索引、RLS、Realtime publication 和 Function 必须通过 supabase/migrations 管理并提交 Git；不要直接修改生产 Dashboard 后不补 Migration。所有暴露表必须启用 RLS，Policy 必须同时限制角色和数据归属；不能使用 user_metadata 做权限判断，不能在前端暴露 service_role/secret key。业务代码通过 Repository/Service 访问数据库，数据库地址和密钥通过环境变量注入。多端写入必须采用记录级 INSERT/UPDATE/DELETE，不得使用整库快照覆盖；核心记录需要 updated_at 和 revision/version，并定义冲突处理。完成后必须验证 Migration、RLS、Realtime、数据隔离和恢复路径。

Agent 开始前必须回答：

1. 本工具的 Schema 名称是什么？
2. 本工具需要哪些表？
3. 哪些表会被浏览器直接访问？
4. 每张表的数据归属字段是什么？
5. RLS 如何限制 SELECT/INSERT/UPDATE/DELETE？
6. 哪些表需要 Realtime？
7. 多端同时修改时如何处理？
8. Migration 放在哪个数据库平台仓库？
9. 是否新增跨工具共享对象？
10. 如何验证和回滚？

## 14. 管理边界和变更分级

| 变更 | 等级 | 要求 |
|---|---:|---|
| 自己 Schema 新增表 | 低 | Migration + 本地验证 |
| 自己 Schema 新增可空字段 | 低 | Migration + 兼容旧代码 |
| 修改字段类型/重命名 | 中 | 兼容迁移 + 备份 + 回滚方案 |
| 修改 RLS | 高 | 双用户/越权测试 + 审查 |
| 修改 platform Schema | 高 | 所有依赖工具评估 |
| 删除表/字段 | 极高 | 数据导出、迁移计划、人工批准 |
| 修改 Realtime publication | 中 | 双端验证和额度评估 |
| 修改 Auth/Storage 全局设置 | 高 | 评估所有工具影响 |

禁止：

- 多个 Agent 同时对 Production 执行 db push。
- 未确认项目就运行破坏性 SQL。
- 直接执行 drop schema ... cascade。
- 把真实用户数据写入 seed.sql。
- 在 SQL、日志、截图中暴露 Secret。
- 依赖前端过滤实现数据隔离。
- 用匿名公开写权限省略 Auth/RLS。
- 用 Realtime 事件代替初始查询和断线重同步。
- 使用先查询再插入代替原子 UPSERT。
- 把生产项目和 Sandbox 项目凭据混用。

## 15. 验收标准

### 15.1 结构

- [ ] 工具拥有独立 Schema。
- [ ] 没有误用其他工具 Schema。
- [ ] 业务表不在 public，或完成专项审查。
- [ ] 主键、外键、唯一约束和检查约束齐全。
- [ ] 外键和常用筛选字段有索引。
- [ ] 时间字段使用带时区类型。
- [ ] 核心字段没有不必要地塞入 JSONB。

### 15.2 安全

- [ ] 所有暴露表启用 RLS。
- [ ] Policy 按数据归属限制。
- [ ] UPDATE 同时配置 USING 和 WITH CHECK。
- [ ] 没有使用 user_metadata 授权。
- [ ] 浏览器没有 Secret Key 或 service_role。
- [ ] 自定义 Schema 已配置 Exposed schemas 和 grants。
- [ ] Storage 路径和 policy 已隔离。

### 15.3 协作

- [ ] Migration 在共享数据库平台仓库。
- [ ] 没有未记录的生产 Dashboard 变更。
- [ ] Migration 可在本地或可选 Sandbox 重放。
- [ ] 只有一个生产发布人/CI。
- [ ] 业务仓库与数据库仓库版本关系明确。
- [ ] 类型文件已更新。
- [ ] 破坏性变更有备份和回滚说明。

### 15.4 多端实时

- [ ] Mac 写入后 PC 收到变化。
- [ ] PC 写入后 Mac 收到变化。
- [ ] INSERT/UPDATE/DELETE 均已验证。
- [ ] 断线重连会重新拉取。
- [ ] 目标表已加入 publication。
- [ ] RLS 不阻止合法事件，也不泄露非法事件。
- [ ] 同时修改同一行时有明确冲突结果。
- [ ] 没有整库快照覆盖。

### 15.5 数据安全

- [ ] 数据库备份已生成。
- [ ] Storage 文件备份已生成。
- [ ] 备份不在 Git。
- [ ] 至少有不同物理介质或不同位置的副本。
- [ ] 本地或可选 Sandbox 恢复演练通过。
- [ ] 已记录恢复步骤。

## 16. 已验证不推荐的做法

### 所有工具共用 public Schema

隔离边界不清，Data API 暴露和 RLS 影响范围扩大。默认使用独立 Schema。

### 每个工具各自直接管理同一个远程项目的 Migration

迁移历史会交错，多个 Agent 可能同时 Push。推荐独立的共享数据库平台仓库。

### 只靠前端过滤，不启用 RLS

前端代码可被绕过，不能实现数据库级安全隔离。

### 使用整份 JSON 快照同步

多端同时修改时容易丢更新，Realtime 也不会替你合并快照。

### 把 Supabase 项目当作无限免费数据库

共享项目会共享数据库、Storage、流量和 Realtime 额度，Free 项目还可能因低活动暂停。

### 把 Supabase Storage 当作备份

生产文件被误删后不一定可恢复，必须另建备份。

## 17. 监控和官方参考

共享项目定期检查：

- 数据库容量。
- Storage 容量。
- 出站流量。
- Realtime 消息和并发连接。
- Edge Function 调用量。
- 项目暂停状态。
- Migration 状态。
- 备份成功状态。
- 关键表异常增长。

截至 2026-09-01，Supabase 官方 Free 页面列出的主要额度包括每项目 500 MB 数据库、1 GB 文件存储、5 GB 出站流量、200 个 Realtime 并发连接、每月 200 万条 Realtime 消息和 2 个活跃免费项目；额度可能调整，执行前以官方页面为准。

官方参考：

- [Supabase Database](https://supabase.com/docs/guides/database/overview)
- [Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)

## 18. 最终规范

以后所有个人工具默认遵循：

```
一个 Supabase 项目
        ↓
每个工具一个独立 Schema
        ↓
所有结构通过 Migration 进入 Git
        ↓
所有暴露表启用 RLS
        ↓
业务代码通过 Repository/Service 访问
        ↓
浏览器只使用 publishable key
        ↓
真实数据不进 Git
        ↓
多端使用记录级写入和 Realtime
        ↓
冲突使用 revision/version 处理
        ↓
数据库和文件都有独立备份
```

这套设计与现有的本地自托管/跨平台部署规范兼容，并进一步提升多项目协作、数据隔离、迁移可追踪性和平台迁移能力。

文档状态：V1.0。Supabase 的价格、免费额度、CLI 参数和产品细节可能变化；执行具体部署前应以官方文档和当前项目实际配置为准。
