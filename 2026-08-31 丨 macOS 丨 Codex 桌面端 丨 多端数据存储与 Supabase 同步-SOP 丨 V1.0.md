# 提示词管理工具：当前诊断、数据存储与 Supabase 多端同步方案

> ⛔ **历史留档（HISTORICAL，2026-09-10 标注）**：本文是 2026-08-31 的当时诊断与方案记录，相关决策已由数据库规范 V1.3（存于 `~/Developer/coding/1.Active/alw丨数据库管理专家/`）与 Docker 规范 V1.1（存于 `~/Developer/coding/docker/`）取代。**仅作沿革参考，禁止作为当前实现 / 部署依据**。

## 1. 文档目的

本文沉淀本次对话形成的完整判断，作为以后继续处理“当前项目的数据存储、局域网同步和 Supabase 云端迁移”时的依据。

本文包含：

1. 当前项目的诊断结论。
2. 当前数据实际保存在哪里、如何读写和同步。
3. Mac 与 PC 不同步的最可能原因和验证方法。
4. 多个小工具共用一个 Supabase 项目的可行性、隔离方式和风险。
5. Supabase 多端修改、实时同步和冲突处理方案。
6. 推荐的短期处理、长期迁移路径、验收标准和避坑事########项。

## 2. 当前项目诊断结论

### 2.1 当前项目不是“两台电脑各自保存并自动合并”

当前项目采用“一个 Next.js 服务端 + 多个浏览器客户端”的结构：

\`\`\`text
Mac 浏览器 ─┐
            ├── 同一个 Next.js 服务 ─── data/store.json
PC 浏览器 ──┘
\`\`\`

只有当 Mac 和 PC 访问同一个 Next.js 服务时，才会共享同一份数据。

如果 PC 访问 \`http://localhost:3100\`，\`localhost\` 指的是 PC 自己；如果 PC 也单独启动一份 Next.js，那么它使用的是 PC 自己的服务进程和数据文件。两台电脑之间没有自动连接，因此数据不会同步。

### 2.2 当前问题的最可能原因

以下判断与代码结构一致，但本次对话没有完成 Mac 与 PC 的现场双向点击验证，因此实际根因仍标记为“待验证”：

> 推测：PC 访问了自己的 \`localhost:3100\`，或 PC 单独启动了另一份项目服务，而不是访问 Mac 上运行的服务。

验证方法：

1. Mac 启动唯一的 Next.js 服务。
2. PC 使用 Mac 的局域网 IP 或 \`.local\` 主机名访问。
3. 从 PC 请求 Mac 的 \`/api/sync\`，确认返回的是 Mac 当前数据。
4. 再执行 PC 新增、Mac 修改的双向测试。

### 2.3 当前项目已经具备的同步能力

当前实现已经包含：

- 服务端共享 JSON 存储。
- \`/api/sync\` 读取和写入接口。
- SSE 实时通知。
- 服务端版本号。
- \`baseVersion\` 乐观并发检查。
- 客户端离线回退到 \`localStorage\`。
- Mac 通过 \`0.0.0.0\` 监听局域网的启动脚本。

因此，当前问题更像是“客户端没有连接到正确的中心服务”，而不是完全没有实现同步功能。

### 2.4 当前实现的结构性限制

当前同步是“整份快照覆盖写入”：

\`\`\`text
客户端修改一条卡片
    ↓
把全部 cards/settings/tags/promptTags 一起 POST
    ↓
服务端整体替换状态
\`\`\`

这适合个人、低并发、数据量较小的局域网使用，但不是细粒度协同编辑方案。

版本号能够发现一部分并发冲突，但不会自动合并两个设备各自的修改。两端同时修改同一条记录时，仍需要刷新、重试或后续增加冲突处理。

## 3. 当前项目的数据存储情况

### 3.1 浏览器本地存储

浏览器使用 \`localStorage\` 保存本机缓存和离线数据：

\`\`\`text
prompt-manager:cards
prompt-manager:settings
prompt-manager:tags
prompt-manager:promptTags
\`\`\`

\`localStorage\` 属于具体的“设备 + 浏览器 + 用户配置文件”，因此：

- Mac Chrome 和 PC Chrome 是两份数据。
- Mac Chrome 和 Mac Safari 也是两份数据。
- 清除浏览器站点数据可能删除本地缓存。
- \`localStorage\` 本身不能实现跨设备同步。

代码：[src/lib/storage.ts:79](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/src/lib/storage.ts:79)

### 3.2 服务端 JSON 文件

服务端数据保存于：

[data/store.json](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/data/store.json)

服务端先把文件加载进 \`serverStore\` 的进程内单例，再通过写入队列异步落盘。

本次检查当前工作区得到：

- 文件存在。
- 约 105 KB。
- 47 张卡片。
- 19 个标签。
- 64 条卡片-标签关联。
- 版本号为 1657。

这些数字只代表本次检查时当前工作区的文件状态，不代表所有设备上的实时状态。

代码：[src/lib/serverStore.ts:6](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/src/lib/serverStore.ts:6)

### 3.3 同步接口和实时通知

客户端启动时读取：

\`\`\`text
GET /api/sync
\`\`\`

客户端修改时提交：

\`\`\`text
POST /api/sync
\`\`\`

实时通知使用：

\`\`\`text
GET /api/sync/stream
\`\`\`

SSE 只推送版本变化；客户端收到通知后，再重新请求完整 \`/api/sync\` 快照。

代码：

- [src/lib/storage.ts:419](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/src/lib/storage.ts:419)
- [src/app/api/sync/route.ts:1](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/src/app/api/sync/route.ts:1)
- [src/app/api/sync/stream/route.ts:1](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/src/app/api/sync/stream/route.ts:1)

### 3.4 离线行为

如果浏览器无法访问 \`/api/sync\`：

1. 客户端进入离线模式。
2. 使用当前浏览器自己的 \`localStorage\`。
3. 页面提示未连接同步服务。
4. 数据只保存到本机，不会到达另一台电脑。

代码：[src/app/page.tsx:158](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/src/app/page.tsx:158)

### 3.5 Git 不负责同步用户数据

\`data/\` 目录被 \`.gitignore\` 忽略，\`data/store.json\` 不会提交到 GitHub。因此：

- 同步代码不会同步数据文件。
- 两台电脑分别拉取代码，不会得到同一份用户数据。
- Git 不应被当作数据库或实时同步系统。

### 3.6 MCP 的额外限制

当前 MCP 子包直接读取它所在机器上的：

\`\`\`text
data/store.json
\`\`\`

\`PROMPT_MANAGER_API_URL\` 主要用于请求复制次数增加 API，不负责远程读取卡片内容。

因此，如果 MCP 在 PC 上运行，而数据文件在 Mac 上，PC MCP 仍可能读到 PC 本地文件。长期迁移时应让 MCP 通过中心 API 或 Supabase 读取。

代码：[mcp/prompt-server/src/index.ts:40](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/mcp/prompt-server/src/index.ts:40)

## 4. 当前局域网方案

### 4.1 正确拓扑

\`\`\`text
Mac：运行唯一的 Next.js 服务
    └── data/store.json

Mac 浏览器 ─┐
            ├── http://<Mac-IP>:3100
PC 浏览器 ──┘
\`\`\`

PC 不需要再启动第二个服务。

### 4.2 启动 Mac 服务

在 Mac 项目根目录执行：

\`\`\`bash
./dev-server.sh start
./dev-server.sh status
\`\`\`

预期状态：

\`\`\`text
next dev: 运行中
端口 3100
HTTP: 200
\`\`\`

脚本使用 \`-H 0.0.0.0\` 监听局域网地址，见 [dev-server.sh:35](/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/dev-server.sh:35)。

### 4.3 PC 访问 Mac

macOS 可以尝试查找局域网 IP：

\`\`\`bash
ipconfig getifaddr en0
\`\`\`

PC 浏览器打开：

\`\`\`text
http://<Mac局域网IP>:3100
\`\`\`

或者：

\`\`\`text
http://<Mac主机名>.local:3100
\`\`\`

不要使用：

\`\`\`text
http://localhost:3100
\`\`\`

### 4.4 局域网验证

在 PC 上请求：

\`\`\`bash
curl -sS http://<Mac局域网IP>:3100/api/sync
\`\`\`

成功条件：返回包含 \`cards\`、\`settings\`、\`tags\`、\`promptTags\` 和 \`version\` 的 JSON。

随后验证：

1. PC 新建标题为 \`SYNC-TEST-PC\` 的测试卡片。
2. Mac 是否出现该卡片。
3. Mac 修改标题为 \`SYNC-TEST-MAC\`。
4. PC 是否自动刷新。
5. 删除测试卡片，确认删除也同步。
6. 删除测试数据并导出备份。

本次对话没有完成实际 Mac-PC 双机点击验证，因此真实 IP、防火墙、局域网隔离和双向操作结果仍为“待验证”。

## 5. 共用一个 Supabase 项目的可行性

### 5.1 结论：可行

可以把 10 个自己使用的小工具放在同一个 Supabase 项目中。

Supabase 每个项目都是完整的 PostgreSQL 数据库，不是只能服务一个网站的特殊数据库。参考：[Supabase Database](https://supabase.com/docs/guides/database/overview)。

推荐结构：

\`\`\`text
一个 Supabase 项目
├── prompt_manager Schema
│   ├── cards
│   ├── tags
│   ├── prompt_tags
│   ├── card_versions
│   └── settings
├── habit_tracker Schema
│   ├── habits
│   └── habit_logs
└── book_notes Schema
    ├── books
    └── notes
\`\`\`

如果暂时不使用自定义 Schema，至少使用不同的表名前缀：

\`\`\`text
pm_cards
pm_tags
pm_prompt_tags

habit_habits
habit_logs
\`\`\`

### 5.2 数据会不会互相覆盖

正常设计下不会自动覆盖：

- \`prompt_manager.cards\` 和 \`habit_tracker.habits\` 是不同对象。
- \`pm_cards\` 和 \`habit_habits\` 是不同表。
- 一个工具查询自己的表，不会自动读到另一个工具的数据。

真正可能发生“打架”的情况是：

- 两个工具误用同一张表。
- SQL 脚本误执行 \`DROP TABLE\`、\`ALTER TABLE\` 或错误迁移。
- 所有工具共用一个无区分字段的 JSON 表。
- RLS 配置过宽，导致一个应用可以看到另一个应用的数据。
- Storage bucket 和文件路径权限没有隔离。

推荐同时使用：

\`\`\`text
Schema/表名前缀：防止结构误用
RLS：防止权限越界
workspace_id/user_id：防止数据归属混淆
\`\`\`

自定义 Schema 参考：[Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)。

### 5.3 共用项目的代价

优点：

- 只维护一个数据库。
- 多个工具复用 Auth、Storage 和 Realtime。
- 对个人项目管理简单。

风险：

- 所有工具共享同一个项目的资源额度。
- 一个项目暂停、故障或配置错误，可能影响全部工具。
- 数据库迁移脚本误操作的影响范围更大。
- 所有工具的备份和权限管理集中在一起。

## 6. Supabase Free 计划情况

截至 2026-08-31，Supabase 官方页面列出的 Free 计划包含：

- 每个项目 500 MB 数据库容量。
- 1 GB 文件存储。
- 5 GB 出站流量。
- 200 个 Realtime 并发连接。
- 每月 200 万条 Realtime 消息。
- 50,000 MAU。
- 2 个活跃免费项目。

参考：[Supabase Pricing](https://supabase.com/pricing)、[Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)。

对个人的 10 个文字型小工具来说，这些额度通常够用，但要注意：

1. 10 个工具共享同一个项目的数据库、流量和 Realtime 资源。
2. 某个工具产生大量日志、图片或实时消息，可能影响其他工具。
3. Free 项目在低活动一段时间后可能暂停，官方说明通常是 7 天低活动。[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
4. Free 计划不提供付费计划级别的自动备份和 PITR，应自行定期导出。

## 7. Supabase 多端修改与实时同步

### 7.1 基本流程

\`\`\`text
Mac 修改数据
    ↓
写入 Supabase PostgreSQL
    ↓
Supabase Realtime 发出变化事件
    ↓
PC 收到事件并更新界面
\`\`\`

Supabase Realtime 支持监听数据库记录的 \`INSERT\`、\`UPDATE\` 和 \`DELETE\`。参考：[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)。

### 7.2 当前个人项目的建议实现

设备少、数据量小，可以先使用 Postgres Changes：

1. 将提示词相关表加入 \`supabase_realtime\` publication。
2. Mac 和 PC 订阅 \`cards\`、\`tags\`、\`prompt_tags\` 等表。
3. 收到事件后更新受影响的记录，或重新查询受影响的数据。
4. 为每条记录增加 \`updated_at\` 和 \`version/revision\`。
5. 同时修改同一条记录时显示冲突，而不是静默覆盖。

Supabase 文档将 Postgres Changes 作为较简单的方案，并建议规模更大时考虑 Broadcast。[Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

### 7.3 Realtime 不等于自动冲突合并

Realtime 解决的是：

\`\`\`text
另一台设备发生了变化，我要及时知道。
\`\`\`

它不自动解决：

\`\`\`text
两台设备同时修改同一条记录，应该保留哪一份？
\`\`\`

因此不建议把当前项目的“整份 cards 快照覆盖”原样搬到云端。更推荐：

\`\`\`text
新增卡片       → INSERT pm_cards
修改卡片       → UPDATE pm_cards
删除卡片       → DELETE 或软删除 pm_cards
标签关联       → INSERT/DELETE pm_prompt_tags
正文版本       → INSERT pm_card_versions
\`\`\`

## 8. 推荐的数据设计和安全边界

### 8.1 提示词工具表

建议使用：

\`\`\`text
pm_cards
pm_tags
pm_prompt_tags
pm_card_versions
pm_settings
\`\`\`

核心字段建议包含：

\`\`\`text
id
workspace_id
user_id（如果支持用户）
created_at
updated_at
version/revision
\`\`\`

\`pm_prompt_tags\` 应设置 \`(prompt_id, tag_id)\` 唯一约束；卡片删除时清理关联，标签删除时按产品规则处理关联。

### 8.2 权限设计

如果应用通过浏览器直接连接 Supabase：

- 使用 Supabase Auth 区分用户。
- 业务表保存 \`user_id\` 或 \`workspace_id\`。
- 每张暴露表启用 RLS。
- RLS policy 同时限制角色和数据归属。
- 前端只能使用 publishable key。
- \`service_role\`/Secret Key 只能放服务端。

Supabase 官方说明：grants 决定角色能否访问对象，RLS 决定能访问哪些行；只设置 \`authenticated\` 角色并不能自动实现用户隔离。参考：[RLS 官方文档](https://supabase.com/docs/guides/database/postgres/row-level-security)。

### 8.3 对当前项目的迁移建议

可以保留现有页面和部分 \`/api/sync\` 接口作为过渡层：

\`\`\`text
现有页面
    ↓
现有 storage API
    ↓
Next.js Route Handler
    ↓
Supabase
\`\`\`

但长期应把内部实现从“整份 JSON 快照”改为“按卡片、标签和关联记录操作”，降低并发覆盖风险。

AI API Key 不应存入共享数据库。当前项目已经在服务端快照中剥离 \`aiApiKey\`，迁移 Supabase 时应继续保持这个原则，或改用服务端环境变量/密钥管理。

## 9. 推荐实施路径

### 阶段一：先修复当前局域网问题

1. Mac 运行唯一的 Next.js 服务。
2. PC 改用 Mac IP 或 \`.local\` 地址。
3. 用 \`/api/sync\` 验证 PC 访问到 Mac 数据。
4. 完成新增、修改、删除双向测试。
5. 清理测试数据并导出备份。

### 阶段二：建立 Supabase 隔离结构

1. 选定一个 Supabase Free 项目作为个人工具数据库。
2. 创建 \`prompt_manager\` Schema，或使用 \`pm_\` 表名前缀。
3. 创建提示词、标签、关联、版本和设置表。
4. 配置 Auth、RLS 和必要的唯一/外键约束。
5. 先迁移一份备份数据，不要直接删除当前 \`data/store.json\`。

### 阶段三：接入实时同步

1. 将需要同步的表加入 Realtime publication。
2. 实现 Mac/PC 的订阅。
3. 完成新增、修改、删除事件。
4. 实现并发冲突和离线恢复。
5. 用两台设备实际验收。

### 阶段四：迁移 MCP

将 MCP 的卡片读取从“读取本机文件”改为：

\`\`\`text
MCP → 中心 API 或 Supabase → 返回卡片
\`\`\`

这样 MCP 在 Mac、PC 或其他设备上运行时都能读取同一份云端数据。

## 10. 验收标准

### 10.1 当前局域网方案

- Mac 只运行一份 Next.js 服务。
- PC 地址栏使用 Mac 的 IP 或 \`.local\` 地址。
- PC 请求 Mac \`/api/sync\` 返回 JSON。
- PC 新增卡片后 Mac 能看到。
- Mac 修改卡片后 PC 能看到。
- 删除操作也能同步。
- 两端不显示离线不同步状态。
- 测试数据已清理并已导出备份。

### 10.2 Supabase 方案

- 每个工具使用独立 Schema 或表名前缀。
- 不同工具之间没有误读、误写权限。
- 所有暴露表启用 RLS。
- 用户/工作区隔离规则通过实际查询验证。
- 浏览器代码中没有 Secret Key 或 \`service_role\`。
- Mac 和 PC 读写的是同一个 Supabase 项目。
- 新增、修改、删除均能实时到达另一端。
- 同时修改同一记录时有明确冲突行为。
- 离线后恢复网络时不会静默丢失数据。
- 已记录数据库、Storage、流量和 Realtime 用量。
- 已建立定期导出备份。

## 11. 异常排查

### PC 看不到 Mac 的数据

\`\`\`text
现象：PC 页面为空或显示旧数据
可能原因：访问了 PC 的 localhost，或 PC 启动了自己的服务
排查：确认地址栏是否为 http://<Mac-IP>:3100；请求 Mac 的 /api/sync
解决：停止 PC 独立服务，改为访问 Mac 地址
\`\`\`

### 页面能打开但提示离线

\`\`\`text
现象：页面可加载，但提示未连接同步服务
可能原因：/api/sync 请求失败
排查：检查 Mac 服务、IP、端口、防火墙和局域网隔离
解决：恢复连接后重新加载页面
\`\`\`

### 两台设备各自有不同数据

\`\`\`text
现象：Mac 和 PC 都能使用，但数据不一致
可能原因：两台设备各自使用 localStorage 或各自的 data/store.json
排查：比较两端访问的 URL 和服务端 API 返回内容
解决：局域网只保留一个中心服务；长期迁移 Supabase
\`\`\`

### Supabase Realtime 没有事件

检查顺序：

1. 目标表是否加入 \`supabase_realtime\` publication。
2. 表是否已启用 RLS。
3. 当前用户是否有 SELECT 权限和匹配的 RLS policy。
4. 客户端订阅的 Schema、表名和事件是否正确。
5. 是否超出 Realtime 额度或连接数限制。

参考：[Realtime Limits](https://supabase.com/docs/guides/realtime/limits)。

## 12. 不推荐的方案

### 两台电脑各自运行 Next.js 并期待 JSON 自动同步

两台服务拥有不同的内存单例和本地文件，没有共同的数据源。

### PC 使用 \`localhost\` 访问 Mac

\`localhost\` 只代表当前设备自身。

### 把 JSON 文件放在共享文件夹，让两个服务同时写

当前项目没有跨进程/跨机器分布式锁、事务和冲突合并。两个服务同时写同一文件可能产生最后写入覆盖或内存与文件不一致。

### 所有小工具共用一张没有 \`app_id\` 的表

容易查询错数据，也无法清晰配置权限。至少使用独立表前缀，最好使用独立 Schema。

### 把 \`service_role\` 放入前端

该密钥权限过高，一旦泄露可能绕过 RLS 访问整个项目。

### 把 Realtime 当作自动冲突解决器

Realtime 负责通知，冲突解决、离线队列和版本合并仍需应用设计。

## 13. 最终结论

短期内，当前项目最合理的做法是：

\`\`\`text
Mac 作为唯一局域网服务端
PC 通过 Mac 的 IP/.local 地址访问
data/store.json 作为共享源
\`\`\`

长期内，把一个 Supabase Free 项目作为 10 个个人工具的共同云端基础设施是可行的。推荐使用独立 Schema 或表名前缀，再配合 RLS、用户/工作区字段和 Realtime。

需要区分两件事：

- 数据共享：通过同一个中心数据库实现。
- 冲突解决：需要按记录版本、更新时间或业务规则额外实现。

文档状态：V1.0。

已确认：当前项目源码中的存储结构、同步接口、离线回退、服务端 JSON 文件和 MCP 本地文件读取方式；Supabase 共用项目、RLS、Realtime 及 Free 计划的官方资料。

待验证：实际 Mac-PC 双机访问地址、防火墙、局域网隔离和真实双向操作结果。
