# Bug 记录（BUGS）

> 当前未关闭 / 已确认的 Bug。由 QA 记录，开发更新修复状态。`【修复】` 优先处理 P0、P1；P2 / P3 / Future 默认不自动开发。

## 最近一次 QA 执行记录

### Air ↔ Mini Supabase 云端双设备验收（2026-09-02）

- **角色/方式**：协助式 QA；由用户在 MacBook Air 与 Mac Mini 实际操作并口头反馈。未提交截图；未记录真实提示词正文、MCP 原始令牌、AI API Key 或数据库密码。
- **统一地址/范围**：两端使用 `http://192.168.31.60:3100`；本轮范围仅 Air ↔ Mini，PC 不纳入验收。
- **时间记录**：2026-09-02；用户未提供具体验收分钟，以下不虚构具体时刻。

| 项目 | 发起设备 | 另一端结果 | 结果 | 证据/复现步骤 |
|---|---|---|---|---|
| 1. 双向新建 | Air、Mini | 两方向均约 3 秒内出现，无需刷新 | ✅ 通过 | 分别新建 `测试-Air-新建`、`测试-Mini-新建`；用户确认两端均实时可见 |
| 2. 双向编辑与版本 | Air、Mini | 两方向均约 3 秒内看到编辑结果；版本历史均增加 | ✅ 通过 | 分别编辑两张测试卡并保存；用户确认无需刷新、版本历史增加 |
| 3. 双向删除与撤销 | Air | Mini 约 1 秒看到恢复及最终删除消失 | ✅ 通过 | 删除出现影响数提示，10 秒内撤销，再次真正删除；用户确认全流程约 1 秒级同步 |
| 4. 标签关系与复制计数 | Mini | Air 看到同一标签关系及复制次数 +1 | ✅ 通过 | 使用 `测试-云端标签` 关联测试卡并复制一次；用户确认准确 +1、无需刷新 |
| 5. 并发冲突 | Air 先保存、Mini 后保存 | 未形成旧版本提交条件 | ⏳ 待验证 | Air 自动保存后，Mini 页面立即出现更新；未完成“另一端保存旧版本”及冲突提示验证 |
| 6. 断网、重连与云端重读 | Air | Mini 作为对照未报告异常 | ✅ 通过 | 用户确认断网、恢复、刷新后验收通过；未提交截图或具体提示文案 |
| 7. MCP 令牌隔离 | Air 生成令牌 | 无法进入双令牌隔离验证 | ❌ 失败 | Air → 设置 → MCP 云端访问 → 生成令牌，出现 `crypto.randomUUID is not a function`；现有 Mini 令牌未撤销 |
| 8. 清理 | Air/Mini | 两端刷新后均无测试数据 | ✅ 通过 | 用户确认测试卡、测试标签已清理，真实云端数据未受影响 |

#### BUG-9：HTTP IP 访问下 MCP 令牌无法生成

- **状态**：FIXED（Air 真机已验证；Mini 复测已于 2026-09-03 通过，见 BUG-11「复测第二轮完成记录」）
- **严重程度**：P0（阻塞 MCP 双设备隔离验收）
- **涉及功能**：MCP 云端访问 / 独立令牌生成
- **前置条件**：Air 以 `http://192.168.31.60:3100` 登录云端，打开「设置 → MCP 云端访问」
- **复现步骤**：点击「生成令牌」；页面显示 `crypto.randomUUID is not a function`。
- **预期结果**：生成一枚仅显示一次、可供该设备配置的 MCP 令牌。
- **实际结果**：Air 无法生成新令牌；无法完成 Air/Mini 各自独立令牌及单独撤销验证。
- **复现概率**：本轮 1/1（Air）；Mini 未重复尝试，避免扩大操作。
- **影响范围**：使用当前固定 HTTP IP 地址的设备可能无法新建 MCP 令牌；现有 Mini 令牌未做撤销验证。
- **建议优先级**：P0；请开发确认安全上下文兼容的 UUID 生成方案，并在 Air/Mini 实际浏览器重新验收。

**开发修复与部署记录（2026-09-02）**：

- 新增同源动态接口 `src/app/api/mcp-access-tokens/route.ts`：在 Node 服务端用 `randomBytes(32)` 生成令牌、用 SHA-256 保存哈希；接口先用 `auth.getUser(jwt)` 向 Supabase Auth 校验来访会话，再以该用户 JWT 受现有 RLS 写入，不使用 `service_role`。
- 浏览器端 `src/lib/supabase/mcpTokens.ts` 不再调用 `crypto.randomUUID()` / `crypto.subtle`，仅将当前会话 JWT 发送到同源接口并接收一次性令牌。
- 开发验证：`npx tsc --noEmit`、修复文件 ESLint、`npm run build -- --webpack`、`mcp/prompt-server npm run build` 均通过；默认 Turbopack 构建曾因 `.next/server` 被占用报 `ENOTEMPTY`，不作为代码失败结论。
- 正式部署：用户授权后仅同步本次修复的两个源码文件至既有 `Services/prompt-manager`，重建并重启现有容器；容器运行中且绑定 `0.0.0.0:3100`。无登录请求 `POST /api/mcp-access-tokens` 返回预期 401，首页返回 200；没有 Supabase 数据库写入。
- 真实验证：Air 已于本轮成功创建新令牌并完成复制/粘贴确认；Mini 的创建、双令牌隔离与单独撤销后的真实结果仍必须由 QA 复测。

#### BUG-10：HTTP IP 访问下 MCP 令牌自动复制被浏览器拒绝

- **状态**：FIXED（Air 真机已验证；Mini 复测已于 2026-09-03 通过——真实点击复制成功且剪贴板哈希比对一致，见 BUG-11「复测第二轮完成记录」）
- **严重程度**：P1（令牌已生成，但阻断一键复制到 MCP 配置）
- **复现结果**：Air 成功创建令牌后，点击「复制到剪贴板」显示「复制失败，请检查当前浏览器剪贴板权限」。
- **根因**：`navigator.clipboard.writeText()` 只在安全上下文可用；固定 LAN HTTP 地址不满足该条件。
- **修复**：`McpCloudAccess.tsx` 优先使用 Clipboard API；失败或非安全上下文时，退回用户点击触发的临时只读 textarea 选区复制，失败才保留原错误提示。不会额外保存或记录令牌。
- **部署与验证**：组件已同步到既有正式 Docker 服务；Docker 隔离生产构建通过，容器运行中，首页 200。Air 已于本轮真实完成“刷新页面 → 创建新令牌 → 点击复制 → 粘贴到本机文本编辑器”并确认复制成功；未记录令牌原文。Mini 将在令牌隔离验收中复测。

#### BUG-11：Mini 本地 MCP 握手成功，但无法实际调取已保存的云端卡片

- **状态**：FIXED（2026-09-03 复测第二轮步骤 0–4 全部通过，Mini + Air 双设备云端链路闭环；测试卡保留待用户清理）
- **严重程度**：P0（阻塞本阶段收口前的真实验收）
- **真实证据（2026-09-02）**：Mini 已完成 Codex MCP 配置写入，stdio 握手和工具注册通过；用户新开 Codex 会话后调用 `mcp-mini`。提示词管理器已搜索命中唯一卡片，卡片显示调取码 `mcp-mini`，但 MCP 返回“未找到调取码为「mcp-mini」的卡片，或 MCP 访问令牌已被撤销”。
- **已排除**：不是输入调取码时未保存；页面搜索已命中该卡片。Mini `.env.local` 的 URL、publishable key、访问令牌三项字段均存在（未读取或记录令牌值）。
- **对照证据**：Air 已可正常通过其本机 MCP 调取云端卡片。因此共享 Supabase 数据、RPC、调取码机制和服务端部署不是本问题的共同故障面。Mini 的 Codex 配置已只读核对为当前项目 `mcp/prompt-server/dist/index.js`，且本机 `.env.local` 修改时间早于失败调用，已排除“改错项目副本”。
- **令牌验证（2026-09-02）**：设置页显示 Mini 令牌的“上次使用”为失败调用后的 `16:09:17`。因此 Mini MCP 已读到当前令牌且云端认可该令牌；不再要求生成、替换或撤销 Mini 令牌。
- **当前待验证根因**：Mini 页面中可见的测试卡可能仅存在于本机编辑状态，尚未成为该令牌归属用户可由 RPC 查到的云端 `cards` 行；也可能存在该用户卡片写入后与 RPC 查询条件不一致的问题。下一步必须先以刷新后的页面状态确认卡片是否真正持久化，不能再以页面输入框或网格即时显示判断云端已保存。
- **开发修复（2026-09-02）**：`src/app/page.tsx` 增加卡片本地变更代次与已同步代次。新建、编辑、删除、撤销、导入、批量评分等卡片操作先标记为待同步；Realtime 回读发现待同步卡片或写队列运行中时持续等待，不再以旧快照整体覆盖本机 state。当前写批次成功后才确认对应代次并允许后续云端回读；写入失败时继续保留待同步状态并走既有重试，不再静默丢弃卡片。
- **部署与开发验证**：用户授权后仅同步 `src/app/page.tsx` 到既有 `Services/prompt-manager`；源文件 SHA-256 一致。Docker 隔离生产构建通过并已重建 `prompt-manager-prompt-manager-1`，容器绑定 `0.0.0.0:3100`、首页 HTTP 200。开发目录的 `npx tsc --noEmit`、`npx eslint src/app/page.tsx`、`npm run build -- --webpack` 均通过。以上均不等同真实双设备验收。
- **验收尝试（2026-09-02）**：用户报告 Mini 与 Air 各新建一张测试卡后，两张均不在列表中。该尝试发生在容器重建后、但未确认两端浏览器已硬刷新并加载新 JavaScript，因此结果为 **失败且客户端版本未确认**；不得据此标记修复通过，也不得据此直接否定新修复。
- **暂缓决定（2026-09-02）**：用户确认本轮先记录、不继续排障。保留上述修复代码与全部证据；恢复时先确认两端客户端版本并按上述验收步骤复现，若仍失败再抓取浏览器实际的 Supabase 保存错误。不得把令牌粘贴到聊天、Git 或其他设备。

**复测进行中记录（2026-09-02 晚，接续会话证据；状态仍为 DEFERRED，未通过）**：

### BUG-12 ｜ 数据丢失事故：云端写失败期间的本机编辑被远端快照无条件覆盖（2026-09-03）

**现象（用户报告）**：Mini 上新建/生成卡片、保存标题和标签后，刷新全部丢失。单设备场景即可触发，与双设备无关。

**证据链（QA 两轮现场报告 + 主会话核验，详见 `docs/qa/2026-09-03 丨 保存丢失排查-Mini端QA现场证据 丨 V1.0.md`）**：
1. Mini 底栏为 legacy 文案 + 页面顶部有「云端登录」按钮 → **会话已掉为未登录**（何时/为何掉无法事后确定，疑与令牌刷新失败有关）。
2. 容器内 `store.json` 最后写入 2026-09-02 22:54，当天 0 写入、仍 54 张 → 用户当天编辑未到 legacy 服务端。
3. localStorage `prompt-manager:cards` 最新卡 `createdAt=2026-09-02T14:50:34Z`，当天 0 张 → **也未落本机**。
4. QA 在 legacy 模式干净复测：POST /api/sync 全程 200、刷新保留（54→55）→ 保存链路本身无故障。

**根因认定**：用户当天处于登录态但云端写入静默失败（会话过期/刷新失败 → 401/超时，toast 未被注意）。云端模式下编辑已先落 localStorage，但随后会话彻底掉为未登录，`connect()` 未登录分支用 legacy 服务端 54 张快照**无条件覆盖视图与 localStorage**，把仅存本机的编辑抹掉。属于设计缺陷：任何远端快照加载路径都没有「覆盖前备份」与「本机独有数据合并」。用户当天数据三方（云端/legacy store/localStorage）均不存在，**无法恢复**——如实记录，不掩饰。

**修复（2026-09-03，Builder；2026-09-04 经用户授权部署完成）**：
1. `backupLocalSnapshot()`（storage.ts）：connect() 应用任何远端快照（云端 force 路径 / legacy 覆盖路径）前，把四组 localStorage 原文滚动备份到 `prompt-manager:preconnect-backup`——同类事故今后必可找回。
2. `mergeLocalOnlyIntoRemoteSnapshot()`（page.tsx）：加载远端快照时把「仅存本机、远端没有」的卡片/标签/关联按 id 增补合并进视图（云端分支基线仍取远端，使其自动成为待推送增量；legacy 分支合并后由 schedulePush 整库补推），并 toast 明示找回数量。远端已有实体一律以远端为准，不做内容级合并。
3. 门禁：tsc 0 错、ESLint 0 错、`npm run build -- --webpack` 通过。
4. **部署核验（2026-09-04）**：Services 副本与开发目录 SHA-256 一致；镜像重建、容器 Recreated/Started、HTTP 200；运行产物含修复标识（`preconnect-backup` 命中 storage chunk，toast 文案「已找回仅存本机/并开始同步」命中 page chunk——函数名因压缩不保留，以字符串字面量核验）；legacy store.json（145,653 B）经重建未变，bind mount 生效。状态：**FIXED（已部署）**；「找回合并」路径待真实场景触发验证（正常使用若出现「已找回」toast 即为机制生效）。

**残余风险**：① 会话掉登录的根因（refresh token 为何未续上）无法事后定位，仅能靠备份+合并兜底；若复发需现场抓 Supabase Auth 网络请求。② legacy 独有的历史测试卡（BUG11 复测占位卡、QA保存测试-0903b、qa测试 标签）在用户重新登录时会被合并进云端——登录前应在 UI 删除不想要的测试卡。

- 预备检查（只读）：容器 `prompt-manager-prompt-manager-1` Up；`src/app/page.tsx` 与 `Services/prompt-manager/` 副本 SHA-256 一致（`c3239b81…`），修复代码确认在运行版本中。
- 第一次尝试：Mini 硬刷新后新建测试卡「BUG11测试任务」（BUG11-测试2），刷新后卡片消失。**关键证据**：DevTools Network 过滤 `supabase` 显示保存动作期间 **0 / 11 requests** —— 保存时根本没有向 Supabase 发出任何请求（写入未发生而非写入失败）；容器日志近 15 分钟无任何报错（写入走浏览器直连 Supabase，不经过容器）。
- 随后同卡再刷新后卡片重新出现（全部 · 54 张），页面登录态正常（`auth/user` 200），5 表 SELECT 全部 200。**疑似**写队列自动重试补写成功，尚未按「cards Response 内搜索 BUG11」确认云端真值，此为待续第 0 项。
- 缓存因素已排除：JS chunk `max-age=31536000 immutable` 但文件名带内容哈希，HTML 无浏览器缓存（ETag 回源），正常刷新即得新代码；「卡片消失」与 HTTP 缓存无关。
- 待续步骤（按序）：0) cards Response 搜「BUG11」确认云端真值与总数；1) 完成 L2 持久化（新建 → 刷新仍在）；2) Air 编辑该卡，Mini 未刷新约 3 秒自动可见；3) Mini 硬刷新确认 Air 修改仍在（旧快照覆盖核心判据）；4) Mini MCP 用 `mcp-mini` 调取 `bug11-test2` 并看复制计数 +1。任何一步失败即停，抓报错原文。
- 已发给用户的 Mini 端 QA 执行提示词与 Air 端配合动作见当轮会话；Mini 端可由独立 QA 智能体按提示词执行，Air 端由用户操作。
- 原始修复内容与此前证据见上方「开发修复」「部署与开发验证」「验收尝试」「暂缓决定」各条，本条不重复。

**复测完成记录（2026-09-02 21:16–22:00，Mini 端独立 QA agent 实测 4 步全执行；Air 端由用户配合；仅浏览器操作 + 只读源码/配置，未改代码/容器/数据。状态维持 DEFERRED——复测未通过，且暴露新根因线索，是否继续修复由主会话决定）**：

- **环境事实（先决）**：:3100 实为 Docker 容器 `prompt-manager-prompt-manager-1`（当天 16:23 重建 = 含 page.tsx 修复代码，SHA 已核对一致），bind mount `/Users/zzymima0000/DockerData/prompt-manager/legacy-store` → `/app/data`；host `./data/store.json`（52 张、mtime 今早 10:27）是本地旧 next dev 实例的陈旧文件，与线上无关，勿据此判断。
- **页面模式（关键新证据）**：全程落「已开启局域网实时同步（legacy）」模式——aside 底栏文案为 legacy 文案（cloud 模式文案应为「已开启 Supabase 云端实时同步」）。Supabase 账号已登录（wanghoufan13@gmail.com），硬刷新窗口快照 5 表 GET 全 200、Realtime WS 曾连上，但 `SupabaseAuthControl` 每次 auth 变化 dispatch `prompt-manager-auth-changed` → page 每次重跑 connect()（云端/局域网二选一，先试云后落 LAN），存在**模式摇摆**；本次最终落 legacy ⇒ **云写链路（仅 cloudMode=true 时触发）从未运行**。
- **步骤1 L2 持久化**：新建「BUG11-Mini-复测」/调取码 bug11-test2/占位正文 → 保存窗口 15 秒+ **零 Supabase 写请求**（无 POST/PATCH，连写方向 OPTIONS 都无）；唯一写 `POST :3100/api/sync` **200**（局域网 serverStore）。硬刷新后卡片在（全部·**54 张**），数据来源 = 容器 legacy store（21:48 写入已含该卡）+ localStorage，**非 Supabase**。刷新窗口 supabase `GET /rest/v1/cards` 响应体捕获 3 份，搜 BUG11-Mini-复测/bug11-test2 **0 命中**。全程 Console **0 报错**。
- **步骤2 Air 变更**：Air 端编辑标题 →「BUG11-Mini-复测2」（容器 store `updated`=13:52:35Z = 北京 21:52:35）；Mini **未刷新**约数秒内自动可见（21:52:55 检出，期间 Mini 零网络请求事件 = 经容器 SSE 长连接推送，非 Realtime WS）。
- **步骤3 旧快照覆盖**：Mini 硬刷新（21:53:23）后卡片在（54 张）、Air 修改在；容器 store 21:53:42 写入（刷新后数据回流容器）；云端 cards 响应体仍 0 命中。
- **步骤4 MCP**：MCP server 0.2.0（dist 当天 14:21 构建）已改为**直连 Supabase RPC `activate_prompt(p_token,p_code)`**，不再读任何本地 store；凭据在 `mcp/prompt-server/.env.local`（16:03 更新，URL/publishableKey/ACCESS_TOKEN 三要素齐全）。同配置协议级真调（spawn 同 dist 同 .env.local）：`bug11-test2` → **isError「未找到调取码为「bug11-test2」的卡片，或 MCP 访问令牌已被撤销」**；UI 复制计数 **0 次**、容器 store `copyCount=0`（RPC 未命中无从计数）。**对照验证**：同链路真调真实在用码 `jbyj` → **activated 命中**（title/正文/计数均正常返回）⇒ RPC、令牌、返回结构全部正常，`bug11-test2` 调不到的唯一原因 = **该卡不在 Supabase 云端**。
- **结论（仅事实）**：按唯一判定标准（Supabase 写成功 + 刷新仍在 + 另一端可见），本次 1/3 成立（刷新仍在、Air 可见）但**全部发生在容器 legacy 局域网体系内**；**Supabase 写请求全程为零、云端自始至终无此卡** ⇒ 新修复（写队列防旧快照覆盖）在当前 legacy 模式下**未进入云写链路，其云端效果无法判定**。三证据闭环：保存零云写 → cards 响应体 0 命中 → MCP RPC 未命中（同链路 jbyj 正常命中）。
- **待 Builder 排查的新根因线索**：cloudMode 为何最终落 legacy（connect 的 cloud 分支要求 `loadPromptCloudSnapshot` 成功且 `hasCloudData`，任一表读 throw/return null 即落 legacy；auth 变化触发 connect 重跑的摇摆机制）。
- **遗留**：测试卡「BUG11-Mini-复测2」（@bug11-test2）由用户决定**保留**在容器 legacy store（bind mount 持久，容器重建不丢）；tags=[测试, qa验收] 疑 Composer 自动生成，非手动添加（观察项）。QA 临时进程（CDP 网络监听 + 独立 Chrome）已于 22:03 全部收尾。

**开发修复二：connect() 模式选择（2026-09-02 深夜，Builder；静态门禁通过，部署与复测待用户授权；BUG-11 状态仍为 DEFERRED）**：

- 根因逐项修复（对应「复测完成记录」三项根因线索）：
  1. **connect() 序列化**（`src/app/page.tsx`）：新增代次守卫，后发起者胜出，旧运行在 await 恢复后检测代次不一致即自行作废；消除 auth 事件并发触发时「云端分支与 legacy 分支交错、后完成的 legacy 覆盖云端」的模式摇摆。
  2. **登录态绝不静默降级 legacy**：新增 `getPromptCloudSessionUser()`（`promptRepository.ts`）——本地 getSession 有会话即判定已登录，getUser 瞬时失败不再被误判为未登录；登录态下快照读取失败 → 云端重试态（2s→4s→8s→16s→30s 退避自动重连 + 顶部持久横幅「云端暂时不可用」+ aside 底栏 cloud 离线文案），绝不 setCloudMode(false)、绝不写 `/api/sync`。
  3. **null/throw 语义区分**（`promptRepository.ts`）：`loadPromptCloudSnapshot` 登录态校验失败改为 throw（原来返回 null 与空库不可区分）；返回 null 仅表示未配置客户端；登录 + 空库（hasCloudData=false）保持云端模式等待显式导入，不落 legacy。
  4. **auth 事件去抖**（`SupabaseAuthControl.tsx` + `page.tsx`）：改派带 session user id 的 CustomEvent；`TOKEN_REFRESHED` 不再触发 connect()（令牌续期由 supabase-js 自动处理）；页面按 user id 变化去抖，同一用户连发事件只跑一次 connect。
- 附带健壮性（同块内）：云端重试期间基线为 null 时不上传设置（防本机缓存覆盖云端）；显式退出登录时清空云端基线与待同步代次（防复用上一账号指纹）；Realtime 单次回读失败不再产生未处理的 promise 拒绝；重连成功时若存在离线期本地修改，toast 明示「未上传云端，仅保留在本机缓存」（不静默丢弃、不自动回灌）。
- 未动范围：未登录 legacy 链路（`data/store.json`、`/api/sync`、SSE）全部保留；未改 Services、未重建容器、无任何数据库变更、未 commit/push。
- 静态门禁：`npx tsc --noEmit` ✅；`npx eslint`（4 个改动文件）✅ 0 error；`npm run lint` ✅ 0 error（仅 scratch/ 既有 warning）；`npm run build -- --webpack` ✅。
- 待办：① 用户授权后同步 4 个改动文件至 `Services/prompt-manager` 并重建既有容器；② 按 `scratch/BUG11-复测-Mini端QA提示词-2026-09-02.md` 重测步骤 0–4（动手前先确认 aside 底栏为「已开启 Supabase 云端实时同步」而非 legacy 文案），真实结果另行记录。

**复测第二轮记录（2026-09-02 深夜，修复部署后；步骤 0–1 通过，2–4 待用户配合后继续；状态仍 DEFERRED）**：

- **部署（用户授权）**：4 个修复文件同步至 `Services/prompt-manager`，SHA 一致（page.tsx `c8b5d745…` / SupabaseAuthControl `15fe70cf…` / TagPanel `2121be1a…` / promptRepository `973b81c8…`）；容器 `prompt-manager-prompt-manager-1` 重建后 Up、绑定 `0.0.0.0:3100`，首页与 `/api/sync` 均 200（仅为运行时检查，不算云端验收）。
- **先决检查 ✅**：Mini 专用 Chrome（CDP 9223）打开 `http://192.168.31.60:3100`，已登录 `wanghoufan13@gmail.com`；**aside 底栏 =「已开启 Supabase 云端实时同步；本机保留离线缓存」**（云端模式文案，不再是 legacy）；无「云端暂时不可用」横幅。
- **步骤 0 云端真值 ✅**：刷新后页面 53 张 = 云端基线；容器 legacy 里的测试卡（BUG11-Mini-复测2）未混入；5 表 SELECT 全 200、`auth/v1/user` 200；Supabase Realtime WebSocket（`wss://…supabase.co/realtime/v1/websocket`）建连握手成功。加载期 mount + INITIAL_SESSION 各触发一次 connect，由代次守卫串行化，符合设计。
- **步骤 1 L2 持久化 ✅**：
  - UI 新建测试卡（占位正文，无敏感信息）→ **`POST /rest/v1/cards → 201`**；AI 标题回写 **`PATCH → 200`**；AI 自动标签 **`POST /rest/v1/prompt_tags → 201`** —— 云写链路真实运行（修复前此类请求为零）；
  - 手动设置标题「BUG11-Mini-复测3」+ 调取码 `bug11-test2`，保存 **`PATCH → 200`**；全程零 `/api/sync` 写、Console 无报错；
  - 硬刷新后卡片仍在（总数 54 = 云端 53 基线 + 1），aside 底栏仍为云端文案；
  - **云端直查**（页面会话 REST，`Accept-Profile: prompt_manager`）：`code=eq.bug11-test2` **命中 1 行**（id `2516da58-e90b-434c-aed1-66482b97a24e`，title「BUG11-Mini-复测3」，copy_count 0），cards 总数 54。
- **待续（用户暂停点，下一步从步骤 2 开始）**：步骤 2 请用户在 Air 编辑该卡（改标题「BUG11-Mini-复测-Air改」）→ Mini 未刷新约 3 秒自动可见；步骤 3 Mini 硬刷新确认 Air 修改仍在（旧快照覆盖核心判据）；步骤 4 Mini MCP 调取 `bug11-test2` 命中 + 复制计数 +1（并顺带复测 BUG-9/10 的 Mini 端）。
- **QA 现场遗留**：专用 Chrome（profile `/tmp/qa-bug11-chrome`，CDP 9223）与网络监听（`scratch/bug11-netmon.mjs` → `/tmp/bug11_net.jsonl`）暂停时仍在运行；`/tmp` 重启即清空，若 profile 丢失需用户本人在该 Chrome 重新登录（QA 不得自行登录）。
- **自动化备注（下一棒省时）**：PreviewPanel 的标题/调取码用合成 input 事件 + blur 无法触发保存（草稿未真正进 React 状态）；可靠做法是真实键盘输入或最后点面板「保存」按钮提交草稿。

**复测第二轮完成记录（2026-09-03 上午，步骤 2–4 全部通过；BUG-11 闭环）**：

- **环境确认**：QA 现场完整保留（专用 Chrome + CDP 9223 + netmon；容器 Up 12h+）；页面已登录、底栏云端文案、总数 54。
- **步骤 2 Realtime 同步 ✅**：用户在 Air 编辑 `bug11-test2` 卡（标题改「BUG11-Mini-复测-Air改」）保存后，Mini 页面**未刷新**即自动显示新标题（首次轮询 T+2s 已命中，实际耗时 ≤3s）；页面已连续运行 43421 秒（≈12h）未重载（`performance` 证据，reloadCount=0）；Realtime 事件触发完整 5 表回读（cards/tags/prompt_tags/card_versions/settings 全 200）。
- **步骤 3 旧快照覆盖核心判据 ✅**：Mini 硬刷新后 54 张、Air 修改仍在、底栏仍为云端文案——旧快照覆盖未发生；云端直查 `code=eq.bug11-test2` 返回 `title=BUG11-Mini-复测-Air改`。
- **步骤 4 MCP 调取 ✅**：`scratch/bug11-mcp-call.mjs` 协议级真调（与 Codex `mcp-mini` 同 dist 同配置）`bug11-test2` → `activation.ok=true`、`status: activated`，返回 **Air 改后的最新标题** + 正文 41 字符 + 标签 [测试]；调取后云端 `copy_count` **0 → 1**。
- **BUG-9 Mini 复测 ✅**：设置 → MCP 云端访问 → 生成令牌 → `POST /api/mcp-access-tokens → 200`，成功提示 + 复制按钮出现，无 `crypto.randomUUID` 错误。
- **BUG-10 Mini 复测 ✅**：CDP 派发**受信任真实点击**「复制到剪贴板」→ 状态「已复制」；系统剪贴板与页面一次性内容**长度+FNV 哈希完全一致**（253 / `564a7184`，未泄露原文）。注意：自动化用 `.click()`（无 user activation）会得到「复制失败」——系自动化无真实手势所致，非产品缺陷；真人点击正常。
- **复测令牌收尾**：生成的复测令牌（label「这台电脑」，创建 2026/9/3 11:00:59）已撤销（`PATCH mcp_access_tokens → 204`，UI 显示「已撤销」）；Mini 在用令牌「Mac Mini」（上次使用 10:59:39 = 本次 MCP 调取）完好保留，供 MCP 双设备隔离验收使用；撤销后的负向 RPC 验证并入隔离验收（届时撤销 Air 令牌后同链路验证）。一次性令牌原文未在任何文档/对话中出现。
- **结论**：BUG-11 判定三件套（云端写入成功回执 + 刷新仍在 + 另一端可见）全部成立，MCP 调取命中且计数递增——登录态稳定保持在 Supabase 云端模式，连接/降级修复验证闭环。BUG-11 关闭；后续按收口顺序进行并发冲突与 MCP 双设备隔离验收。

**并发冲突验收记录（2026-09-03 上午，Air + Mini 双设备实测；验收通过 + 1 项新观察待开发定级）**：

- **方法**：Air 与 Mini 同时操作同一张测试卡 `bug11-test2`；为消除人为时序不确定性，Mini 页面用 CDP 网络延迟仿真（20s/请求）拉宽写入窗口，Air 在窗口内连续保存；全程逐秒记录云端 revision/title（shell 直连 REST）与 Mini toast（CDP 轮询）。
- **时间线证据**：
  - 基线 rev=8 title「BUG11-Mini-复测-Air改并发」（Air 预编辑已保存）；
  - 11:39:43 Mini 触发写入（评分 0→4，被 20s 延迟挂起）；11:39:45–47 Air 首次保存落库（rev 8→9），落入 Mini 的 revision 读取窗口；
  - **11:40:01 Mini toast：「云端卡片保存失败：这条内容已在另一台设备更新，请刷新后再修改」——明确冲突提示出现** ✅；
  - Mini 的挂起写入被服务端 revision 条件更新拒绝（0 行），**未静默生效** ✅；整个风暴期间（Air 连续保存把 rev 推至 39）云端 title 始终为 Air 内容，**未被覆盖** ✅；
  - 收敛终态：rev=39、title=Air 内容、rating=0、updated_at=Air 最后保存时刻；无数据丢失。持续并发下按「最后写入者胜」收敛（Air 后续保存携带其界面视图完整载荷），符合记录级 revision 写入的预期语义。
- **判定：✅ 并发冲突验收通过**（明确冲突提示 + 被拒写入不静默生效 + 另一端内容完好；对照规范 §3.3/§11.1 L4）。
- **新观察（写队列停摆，待开发定级，不阻塞上述验收结论）**：
  - 11:40:40（Air 最后一次保存）后 Mini 停止一切 Supabase 请求：重试链死亡；此后本地两次评分编辑（4星→5星）入队但**不产生任何网络请求**；标签页前台化 + 等待 90 秒均无恢复（排除后台定时器节流）；
  - 本地 rating=5 与云端 rating=0 持续分歧（`performance` resource 证据：最后完成请求 11:41:26，之后再无）；
  - 刷新页面后恢复正常（云端快照应用；本机未上传的评分改动按既有设计弃于界面、保留在 localStorage）；
  - 疑因：supabase-js fetch 无超时 + 冲突风暴中某个请求未决阻塞串行写队列（未定论；本轮含 20s 人工延迟仿真，真实环境触发条件未知）；
  - 建议：开发评估写队列单项超时/自愈与 `retryCloudSync` 链路健壮性；对照规范 §9.2「失败不能静默丢弃」——当前表现是「不再尝试且无提示」，与该条存在张力。
  - **开发修复（2026-09-03 晚，Builder；已部署；用户明确不做双设备冲突回归，状态如实标注）**：根因确认为 `enqueueCloudWrite` 串行链无超时——supabase-js fetch 无默认超时，一个未决请求即永久阻塞队列且无提示。修复：每项写入与 30 秒超时竞速（`Promise.race`），超时/异常均走「toast 提示 + `retryCloudSync` 自动重试」，队列继续流动；迟到原请求若最终落库，由既有 revision 条件更新 / 追加式版本 upsert / 复合主键幂等 upsert 保证不产生静默覆盖或重复数据。改动集中于 `src/app/page.tsx` 的 `enqueueCloudWrite` 单点。门禁：`tsc --noEmit` 0 错、ESLint 0 错、`npm run build -- --webpack` 通过。**回归注意**：单项超时覆盖整个 work 项（一次 revisionedSave 含 2–3 个查询），CDP 延迟仿真请用 ≤8s/请求，否则 30s 超时会在多查询项上先触发（行为仍正确，但会以超时路径而非冲突路径呈现）。
  - **运行模式决定（2026-09-03，用户再次确认）**：用户长期只在 Mini 单设备使用，**不做、也不再被建议做双设备冲突回归**；后续任何会话不得以验收理由要求用户配合第二台设备。本修复的冲突场景回归按用户决定搁置，状态保持「已部署、未做冲突回归」——不标为通过。单设备下同样受益：写队列若再遇挂死请求，30 秒后自动 toast 提示并重试，不再静默停摆。

**MCP 双设备令牌隔离验收记录（2026-09-03 下午，PASS）**：

- **前置根因修复（本轮新发现并解决）**：Air 端 MCP server 实为 8/29 构建的**旧版本地文件版**（读 Air 本地 data/store.json，与云端无关；dist 中无 activate_prompt 真代码、无 .env.local 加载逻辑）——这是「Air 端大面积未找到、令牌云端从未使用」的真正根因（新版 RPC 代码此前从未推送至 Air 克隆）。修复：Mac mini 将 bb32e42 推送为交付分支 `origin/mcp-delivery`（远端 master 存在另一工作线的 7 个提交，为避免覆盖未直接推 master，master 分叉整合待后续单独处理）；Air 切分支 → npm run build（0.2.0）→ 注入新令牌 → **清理 10 个长驻旧 MCP 进程**（「改了 dist 也不生效」的隐藏坑）→ 重启 Codex/WorkBuddy。
- **验收步骤与证据（双端真实操作 + 云端记录）**：
  1. Air 新令牌「MacBook Air」（11:59:42 生成）真实调取：云端「上次使用」从「从未使用」→ **13:47:19 / 13:56:09** ✅；被调卡片 copy_count 递增（bug11-test2→10、hi→4）✅；
  2. Mini「Mac Mini」令牌协议级调取 `bug11-test2` + `hi` 均 ✅；
  3. 撤销「MacBook Air」令牌（14:04:55，Mini 端设置页操作）：UI「已撤销」+ 云端 revoked_at 双确认 ✅；
  4. **撤销后 Air 协议级真调 `hi` → isError=true**，文案「未找到调取码为「hi」的卡片，或 MCP 访问令牌已被撤销。」——与预期完全一致，isError 由 false 翻转为 true，证明是云端实时校验令牌状态 ✅（负向）；
  5. **撤销后 Mini 调取 `hi` 仍成功** ✅（隔离性：仅撤销一枚不影响另一枚）。
- **判定：✅ MCP 双设备令牌隔离验收通过（含撤销负向验证）**；Air 端修复后 hi / bug11-test2 / hi9 均 via 新版 RPC 成功（Air 智能体四层验证：协议级 / 云端记录 / Web 端 / Codex 端到端）。
- **附加发现（记录待产品评估）**：自然语言调用（Codex/WorkBuddy）下，含连字符的调取码（bug11-test2）实测被改写导致「未找到」，无杠简单码（hi / hi9 / hi1–hi7）稳定成功；Mini 协议级精确传参不受影响。建议：调取码规则避开连字符或在 MCP 工具描述中明确（列入收口材料观察项）。

**基线备份与隔离恢复演练记录（2026-09-03 14:22–14:35，当前 55 张卡基线；生产零写入）**：

- **备份（对生产只读，supabase CLI dump）**：`DockerBackups/prompt-manager/` 下三件（timestamp 20260903-142203）：roles 370 B / structure 22,004 B / data 173,345 B。结构尺寸与 9/2 基线完全一致 = 结构未变；数据增大 = 今天验收新增内容，合理。备份不进 Git。
- **隔离恢复演练**：postgres:17-alpine 容器（不发布端口、仅 docker exec），按序恢复：补建平台角色/extensions schema/supabase_realtime publication → 角色转储 → auth stub（6 表，仅列名无数据值）→ 结构（滤 supabase_vault 1 行）→ 数据，`ON_ERROR_STOP=1` 全程**零错误**。过程中修正 2 个演练脚本问题并已记入 scratch/restore-drill/ 流程：PG17 不支持 `CREATE PUBLICATION IF NOT EXISTS`；roles 转储需预建 supabase_realtime_admin / supabase_admin 角色。
- **恢复后验证全绿**：cards 55 / card_versions 18 / tags 24 / prompt_tags 91 / settings 1 / mcp_access_tokens 10；外键孤儿 5 项全 0；调取码 6/6 唯一；RLS 6 表全启用 ×各 4 策略；函数 activate_prompt + set_row_metadata 在位；publication 覆盖 5 表；settings 表**不存在 ai_api_key 列**（密钥结构性不可能落库）；RPC 随机令牌冒烟返回 0 行（拒绝正确）。
- **收尾**：演练容器已删除（零残留）；本机临时会话令牌文件已清除。对比 9/2 演练（52 卡）：本轮回填了 BUG-11 修复后真实使用中的 55 卡基线证据。
- **测试卡清理终态（用户决策）**：12 张带码测试卡已经界面批量删除（云端 REST 验证 0 残留）；**1 张无码「未命名提示词」（今天 12:29:56 创建）经用户决定保留在云端**，当前云端总数 **54**（53 张真实卡 + 该保留卡）；容器 legacy store「BUG11-Mini-复测2」亦保留。后续备份/对账以 54 为准。

### 通用 AI 接口实现验证（2026-08-29）

- **模式**：QA 静态代码核对 + TypeScript / ESLint 门禁
- **结果**：**PARTIAL**（核心实现核对通过；发现 1 项配置风险）
- **构建门禁**：`npx tsc --noEmit` ✅ 通过；`npm run lint` ✅ 0 错误，但有 1 个既有 warning：`scratch/api-doc-test/run.mjs:309` 的 `f0` 未使用
- **未覆盖**：未使用真实厂商 API Key 进行在线请求验证；未执行浏览器设置页交互
- **逐项结果**：
  1. `src/lib/ai/types.ts` ✅ 定义 `AIProvider` 8 家厂商、`AIConfig`、`ChatMessage`、`ChatOptions` 和 `AIAdapter`，与当前适配器调用契约一致。
  2. `src/lib/ai/factory.ts` ✅ switch 完整注册 DeepSeek、智谱、腾讯、豆包、Kimi、Google、OpenAI、OpenRouter 共 8 家厂商，未知值抛出错误。
  3. `src/lib/ai/deepseek.ts` ✅ 继承 `BaseAIAdapter`，保留 `DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL` 环境变量、默认模型和去除末尾斜杠逻辑；现有 `generateMeta`、`summarizeThinking`、`formatBody` 均经 `src/lib/ai.ts` 统一调用链接入。
  4. `src/components/SettingsModal.tsx` ✅ 显示 AI 服务选择、模型、Base URL、API Key，8 家厂商均标记可用；切换厂商会切换默认模型并清空 Base URL。
  5. `src/lib/types.ts` / `src/lib/storage.ts` ✅ `Settings` 包含 `aiProvider`、`aiModel`、`aiApiKey`、`aiBaseUrl`；默认值、旧数据归一化、localStorage 读写及服务端同步链路均已覆盖。

### BUG-8

- **状态**：OPEN
- **严重程度**：P1
- **涉及功能**：通用 AI 接口的多厂商 API Key 环境变量回退
- **前置条件**：在设置中选择非 DeepSeek 厂商，API Key 留空
- **复现步骤**：选择 OpenAI、智谱或其他非 DeepSeek 服务；保持 API Key 为空；触发标题、标签、摘要或正文整理请求
- **预期结果**：按当前厂商读取对应的服务端环境变量，或明确提示该厂商未配置密钥
- **实际结果**：`src/lib/ai.ts:35-38` 固定回退 `process.env.DEEPSEEK_API_KEY`，可能把 DeepSeek 密钥发送至其他厂商 Base URL
- **复现概率**：100%（满足前置条件时）
- **影响范围**：所有未在设置中显式填写 API Key 的非 DeepSeek 配置；可能导致鉴权失败或密钥误发
- **备注**：设置页 `SettingsModal.tsx:343-346` 也固定提示 `DEEPSEEK_API_KEY`。建议按厂商建立环境变量映射，或仅允许 DeepSeek 使用该回退。

### Bug #2 残留修复：resolveTagIds 路径解析被历史扁平标签遮蔽（2026-08-29）

- **状态**：✅ **FIXED**（Builder）
- **现象**：Composer 自动标签 / 卡片编辑标签 / 批量打标签 输入 `自动化/每日` 时，未按层级创建父（自动化）+ 子（每日），而是关联到历史遗留的整串扁平标签 `自动化/每日`（`tag_id-mtdxkb70-qliodfs7`，1 张卡片关联）。
- **根因**：`resolveTagIds` 先按整串名匹配已有标签（顶级优先），命中历史扁平 `自动化/每日` 后跳过 `/` 路径解析；此前 Bug #2 仅修复了 TagPanel `handleCreateTag`，`resolveTagIds` 路径（Composer / 编辑 / 批量）仍被遮蔽。
- **修复**（`src/app/page.tsx`）：名称含 `/` 时优先按「父/子/孙」逐级解析层级（复用已存在父级、缺失则创建），卡片关联叶子；若存在整串同名的顶级扁平标签（且无子标签），将其关联并入层级叶子并删除扁平实体（含 (prompt_id, tag_id) 去重）。`resolveTagIds` 新增接收/返回 `promptTags`，三个调用点（handleCreate / handleUpdateMeta / handleBulkTag）同步适配。
- **验证**：tsc --noEmit ✅、npm run lint ✅（仅 scratch/ 既有 warning）；用 store.json 实测：`自动化/每日` → 新建顶层 `自动化` + 子标签 `每日`，扁平残留自动删除并迁移关联；`SOP/每日` 复用已有层级无回归。
- **说明**：存量扁平标签 `自动化/每日` 无需手工删除，下次任一入口输入该名会自动迁移；也可在 TagPanel 手动删除（删除后卡片标签由 promptTags 真源重建）。

---

### Bug #2 子标签层级关系复测（2026-08-29）

- **环境**：Chrome 真机浏览器，`http://localhost:3100`
- **操作**：点击「新建标签」，输入 `SOP/测试`，按回车确认
- **结果**：**PASS**
- **观察**：标签面板自动展开 `SOP`；`SOP` 显示为父标签，`测试` 以缩进形式显示为子标签；同时出现「已创建标签『SOP/测试』」提示。
- **证据**：`scratch/qa-real-device/bug2-sop-test-hierarchy.png`
- **阻断项**：无

### 标签输入与新建子标签复测（2026-08-29）

- **环境**：Chrome 真机浏览器，`http://localhost:3100`
- **模式**：QA Acceptance（Orca Computer Use + 截图核验）
- **执行者**：QA / Test Agent
- **结果**：**PARTIAL**
- **Bug #1 标签输入白色区域**：✅ **PASS**。点击标签搜索输入框并聚焦后，仅显示一个输入区域，未出现额外的 Chrome 自动填充白色面板。证据：`scratch/qa-real-device/bug1-tag-input-single-panel.png`
- **Bug #2 新建子标签**：✅ **FIXED**（2026-08-29）。根因：TagPanel「新建标签」走 `handleCreateTag`，把 `SOP/开发` 直接创建为顶级扁平标签，未按 `/` 拆分为层级（`resolveTagIds` 与 TagPanel 树渲染本身正确）。修复：`handleCreateTag` 支持路径创建，按「父/子/孙」逐级建层级并复用已存在父级；TagPanel 创建后自动展开路径根节点。真机复测：`SOP` 为父标签、`开发` 为其子标签（缩进层级），已清理旧的扁平残留 `SOP/开发`（0 关联）。构建门禁：tsc --noEmit ✅、npm run lint ✅。
- **测试数据**：保留新建的 `SOP/开发`，便于后续修复复测；当前标签总数由 46 增至 47。

---

- **日期**：2026-08-28（Composer 交互重构验证）
- **模式**：QA Acceptance（静态检查 + Chrome 真机浏览器交互）
- **执行者**：QA / Test Agent
- **结果**：**PARTIAL**（交互流程通过；AI 后台标题/标签生成未通过；服务状态在收尾时异常）
- **构建门禁**：`npx tsc --noEmit` ✅；`npm run lint` ✅
- **逐项结果**：
  1. 「自动生成标签」与「自动生成标题」显示且默认勾选 ✅
  2. 空内容时「生成卡片」仍可见（仅 disabled）✅
  3. 按钮文字为「生成卡片 (Enter)」✅
  4. 默认直接添加模式真实粘贴内容后立即建卡 ✅（`composer-real-paste-auto-qa`）
     - 默认模式下单独“填入后点击”补测未完成：填充后按钮仍 disabled，未形成有效点击证据；不计入通过。
  5. 手动确认模式点击按钮立即建卡 ✅（`composer-manual-click-qa`）
  6. 手动确认模式按 Enter 立即建卡 ✅（`composer-manual-enter-qa`）
  7. 设置存在「添加模式」，默认选项为「默认直接添加」✅
  8. 切换「手动确认」后真实粘贴不自动建卡，按钮保持可用 ✅
  9. 创建后后台 AI 标题/标签生成 ❌；等待 5 秒后仍为「未命名提示词 / 未打标签」
- **环境阻断**：验收收尾时 `localhost:3000` shell 请求返回 000；项目 watchdog 启动因已有 Node 进程占用 3000 端口而退出（EADDRINUSE）。
- **测试数据**：新增了带 `composer-*-qa` 前缀的验收卡片，未删除以避免未经确认的浏览器删除操作。

---

### 上一次 QA 执行记录

- **日期**：2026-08-28（P0-H MCP 连接一键复制提示词验收）
- **模式**：QA Acceptance（代码走查 + 真机 Orca Computer Use + 剪贴板核验）
- **执行者**：QA / Test Agent
- **结果**：**ALL PASS**（P0-H 4 项验证全通过，无新增 Bug）
- **构建门禁**：tsc --noEmit ✅ 0 错误；`npx eslint src` ✅ 0 错误；MCP 子包 `npm run build` ✅
- **API 验证**：curl /api/sync 正常
- **commit 验证**：未提交
- **已关闭**：无新增关闭
- **阻断项**：无

### P0级用户反馈问题整改验证结果（4 项）

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | P0-D 标签切换逻辑修复 | ✅ PASS | 单击切换，再次单击取消，功能正常 |
| 2 | P0-E 标签拖拽功能实现 | ✅ PASS | 拖拽功能已实现，有操作提示 |
| 3 | P0-F 右侧预览面板排版优化 | ✅ PASS | 标题突出，调取码收进标题行 |
| 4 | P0-G MCP连接说明文档 | ✅ PASS | 设置中新增MCP连接说明 |

**详细报告**：`scratch/qa-real-device/P0-QA-REPORT-20260828.md`
**截图证据**：`scratch/qa-real-device/01-09-*.png`（共 9 张）

### P2-10/P2-11 验证结果（12 项）

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | P2-10 删除按钮可见性 | ✅ PASS | CardItem hover 时显示删除按钮（text-rust 样式）|
| 2 | P2-10 删除确认对话框 | ✅ PASS | 点击删除按钮弹出 confirm「确定删除「{title}」？」|
| 3 | P2-10 删除后卡片移除 | ✅ PASS | 确认后卡片被移除，总数 33→32 |
| 4 | P2-10 demo 视图不显示删除按钮 | ✅ PASS | isDemoView 时 onDelete prop 不传递 |
| 5 | P2-11 多选框可见性 | ✅ PASS | 卡片 hover 时出现 checkbox（role="checkbox"）|
| 6 | P2-11 批量选择功能 | ✅ PASS | 点击 checkbox 选中卡片，批量操作栏出现 |
| 7 | P2-11 批量操作栏 | ✅ PASS | 显示打标签/打星/导出/删除/取消选择按钮 |
| 8 | P2-11 批量删除确认 | ✅ PASS | 点击删除按钮弹出 confirm「确定删除选中的 1 张卡片？」|
| 9 | P2-11 批量删除执行 | ✅ PASS | 确认后卡片被移除，总数 33→32 |
| 10 | P2-11 批量删除撤销 | ✅ PASS | notifyWithUndo 显示「已删除 1 张卡片」+ 撤销按钮 |
| 11 | P2-11 取消选择 | ✅ PASS | 点击「取消选择」清空 bulkIds，批量操作栏消失 |
| 12 | P2-11 批量打标签/打星/导出 | ✅ PASS | 代码走查确认逻辑正确 |

### 既有回归

- P0-4/P0-5/P2-6/P2-7/P3-4/P3-5/P2-1/P2-5/P2-3/P2-4/P3-2 已 CLOSED ✅
- P0 标签系统 22 项：未触碰相关代码 ✅
- BUG-NEW-1（chip 移除双写）：仍 CLOSED ✅
- tsc --noEmit 零错误 ✅
- npm run lint 零错误 ✅

---

## 历史 QA 执行记录

### 第十三次 - P0 标签系统真机 GUI 复测（2026-08-28）

- **日期**：2026-08-28
- **模式**：QA Acceptance（真机 Orca Computer Use 操作）
- **结果**：**PARTIAL**（5 项测试中 4 项 PASS，1 项发现 Bug）
- **阻断项**：1 项 Bug（chip × 移除标签时 card.tags 未同步）

### 真机复测结果（5 项）

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | 重命名「开发恢复」→「开发恢复2」 | ✅ PASS | 标签面板、chip、输入框同步更新，API 持久化 |
| 2 | 删除「预览服务」（1 关联） | ✅ PASS | 弹窗显示 1 条，确定后标签消失，卡片保留，API 确认清理 |
| 3a | 移动「代码检查」到「编程」下 | ✅ PASS | 层级结构正确，API 持久化 |
| 3b | 环路检测：「编程」→「代码检查」 | ✅ PASS | Toast「不能移动到自身或自己的子标签下（会形成循环）」 |
| 4 | 同级重名拒绝 | ⚠️ PASS | 标签未改名（重名被拒绝），toast 可能已闪现消失 |
| 5 | Card chip × 移除标签 | ❌ BUG | × 移除单个标签生效（count -1），但 card.tags 未同步（UI 仍显示旧 chip） |

### 两项逐条验证

**P0-4 网格卡片直删入口（可配置二次确认）**
- `Settings.confirmDelete`（types.ts:27）：`boolean` 类型，`DEFAULT_SETTINGS = true` ✅
- `normalizeSettings`（storage.ts:70-78）：`typeof s.confirmDelete === 'boolean' ? s.confirmDelete : true`，非布尔补 true ✅
- `DEFAULT_SETTINGS`（storage.ts:66）：`{ thinkingSummaryPrompt: '', confirmDelete: true, theme: 'system' }` ✅
- `loadSettings`（storage.ts:80-88）：走 `normalizeSettings` 归一化 ✅
- `CardItem` `onDelete` prop（CardItem.tsx:18）：`optional`，`!readonly && onDelete` 时渲染删除按钮（line 86-98），`stopPropagation` 调 `onDelete(card.id)` ✅
- `handleDeleteCard`（page.tsx:352-360）：`if (settings.confirmDelete && !window.confirm(...)) return` → 否则直接删 ✅
- `handleDeleteCard` 三分支：`setCards(filter)` + `setDetailId(null)` + `setSelectedId(null if selected)` + `notify('卡片已删除')` ✅
- `CardItem` 传 `onDelete`（page.tsx:524, 547）：`isDemoView ? undefined : handleDeleteCard`；demo 视图不传（CardItem 不显示删除按钮）✅
- `SettingsModal` Switch（SettingsModal.tsx:53-77）：`role="switch"` + `aria-checked` + `aria-label`，`onClick` 即存 `onSave({ ...settings, confirmDelete: !settings.confirmDelete })` ✅
- `handleSave`（SettingsModal.tsx:29）：合并 `onSave({ ...settings, thinkingSummaryPrompt: trimmed })` 保留 confirmDelete/theme 不覆盖 ✅

**P0-5 搜索高亮配色重做 + 亮色主题**
- **高亮变量**（globals.css:17-20）：`--color-highlight: rgba(251,191,36,.42)` / `--color-highlight-text: #fef3c7` / `--color-highlight-ring: rgba(251,191,36,.32)`（暗色 amber-400 高对比，WCAG AA）✅
- **亮色变量**（globals.css:29-48）：`html.light` 覆盖整组 `--color-*`（ink-950→#f4f1ea / paper→#23272f / gold→#a8782e / highlight→#fde68a / highlight-text→#78350f 等暖纸墨方案）✅
- `color-scheme: light`（globals.css:54-56）：`html.light` 下生效 ✅
- **mark 走变量**（CardItem.tsx:34）：`bg-highlight text-highlight ring-1 ring-highlight-ring`，CSS 变量驱动双主题自动适配 ✅
- **防 FOUC 内联脚本**（layout.tsx:15-19）：`dangerouslySetInnerHTML` 读 `localStorage['prompt-manager:settings']` 的 theme → `prefers-color-scheme` 判定 → `classList.toggle('light', light)`；React hydrate 前执行 ✅
- `<html suppressHydrationWarning>`（layout.tsx:11）：抑制内联脚本预置 class 与 SSR 不一致触发的 hydration warning ✅
- **主题 useEffect**（page.tsx:77-89）：`apply()` 幂等切换 `classList.toggle('light', light)`；system 模式 `mq.addEventListener('change', apply)` 实时跟随 + cleanup `removeEventListener` ✅
- **初始 state**（page.tsx:40-44）：`{ thinkingSummaryPrompt: '', confirmDelete: true, theme: 'system' }` 与 DEFAULT_SETTINGS 一致 ✅
- **SettingsModal 主题 select**（SettingsModal.tsx:78-94）：`<select>` 三选项（system/dark/light），`onChange` 即存 `onSave({ ...settings, theme })` ✅
- **normalizeSettings** theme 归一（storage.ts:72）：`'dark'|'light'|'system'` 三值校验，其余回退 `'system'` ✅
- **Settings.theme**（types.ts:29）：`'dark' | 'light' | 'system'` 联合类型 ✅

**既有回归**
- P2-8 搜索相关度 / P2-9 标签删除 × / P3-6 左对齐：代码路径未改变 ✅
- 失焦保存不建版 / 手动建版：bodyDirtyRef 机制未改变 ✅
- API `/api/sync` 正常返回数据（curl 测试通过）✅

**已知小风险（不阻断）**
- Composer.onCreate 在 `onCreate` 同步返回 `false` 后仍 `setText('')` + `notify('已创建卡片')`，用户取消 confirm 后会看到「已创建卡片」toast 但实际未建卡（CURRENT_STAGE 已记录，建议未来 Composer 改 `onCreate: () => boolean` 协议）
- P0-5 亮色主题 Switch 关闭态轨道 `bg-ink-700`（#cfc9ba）+ 白点对比稍弱（1.3:1），但开启态金色（#a8782e 对比 #cfc9ba 4:1）+ aria-checked 无障碍标识清晰，WCAG 对开关状态指示要求 3:1 已达成

### GUI 测试用例（需人工执行）

**T1: 失焦不建版、手动保存才建版**
- 步骤：打开 http://localhost:3000 → 选卡 → 修改正文 → 失焦（2次）→ 观察版本数 → 点保存
- 预期：失焦版本数不增加；点保存后版本数+1
- 验证：curl /api/sync 中该卡 versions 数组长度

**T2: 500ms内连改两张卡同步一致性**
- 步骤：选卡A改标题 → 立即切卡B改标题 → 立即切回卡A再改 → 等2-3秒
- 预期：curl /api/sync 中A、B两卡标题与页面一致
- 验证：刷新页面确认UI拉取结果与本地一致

**T3: 弹窗内快捷键屏蔽**
- 步骤：双击卡片打开详情 → 点击按钮获得焦点 → 按1/3/5
- 预期：背景卡评分不变、无toast
- 验证：关闭弹窗后确认背景卡星级未变

**T4: Esc关闭详情内容保留**
- 步骤：详情弹窗修改标题 → 不失焦直接Esc → 重开详情
- 预期：标题修改已保留
- 验证：curl确认服务端已落盘

**T5: 备注切换卡片不丢失**
- 步骤：选卡A输入备注 → 700ms内切卡B → 等1秒检查
- 预期：卡A备注已保存、卡B备注为空
- 验证：curl核对A.notes正确、B.notes未变

**T6: Markdown导出导入完整还原**
- 步骤：点导出下载.md → 点导入选择.md文件 → 确认覆盖
- 预期：导入成功、卡片数与导出一致
- 验证：curl核对卡片数

**T7: 双卡同码冲突语义**
- 步骤：卡X设调取码qatest失焦 → 卡Y改标题+调取码qatest失焦
- 预期：卡Y标题已保存、调取码未落盘、有冲突提示
- 验证：静默保存时也应有冲突提示

| 编号 | 描述 | 严重度 | 状态 | 负责人 |
|---|---|---|---|---|
| BUG-4 | 跨设备同步依赖 dev 服务所在机器开机且服务存活；Mac 睡眠或服务退出后同步中断（已知限制，非缺陷） | P2 | 已知限制 | — |
| BUG-5 | WorkBuddy「调取」后是否自动按卡片角色执行，取决于模型遵循工具描述；若仍询问用户，需在 WorkBuddy 全局系统提示词加固定指令（见 HANDOFF） | P2 | 已知限制 | — |
| BUG-6 | 回滚版本时 `rollbackToVersion` 先对当前正文做版本快照再覆盖，导致每次回滚都新增一条重复版本记录、污染历史 | P1 | 已修复（2026-08-25，改动 `src/lib/cards.ts`） | — |
| BUG-7 | `npm run lint` 报错：React 19 要求 refs 只能在 effect/event handler 中赋值，不能在 render 阶段。涉及 `CardDetail.tsx:67` 和 `PreviewPanel.tsx:74` 的 `draftRef.current = draft` | P1 | 已修复（2026-08-26，`PreviewPanel.tsx` / `CardDetail.tsx`：`draftRef` 改用 `useEffect` 同步，不再渲染期赋值） | — |

> 历史 BUG-1/2/3（见 CODE_REVIEW.md）已于 2026-08-25 随「同步 + UI + MCP」改造确认修复并关闭；BUG-6 回滚污染历史于同日修复。

---

## 工位A QA 记录（2026-08-27，P0-6/P2-6/P2-7/P3-4/P3-5 五合一）

### P0-6 搜索高亮双主题配色二次优化
- **暗色** `globals.css:18-21`：`--color-highlight: #fbbf24`（amber-400），`--color-highlight-text: #111111`（ink-950），`--color-highlight-ring: rgba(252,211,153,0.6)`，`--color-highlight-shadow: rgba(251,191,36,0.25)` ✅
- **亮色** `globals.css:45-48`：`--color-highlight: #fcd34d`（amber-300），`--color-highlight-text: #451a03`（amber-950），`--color-highlight-ring: rgba(217,119,6,0.5)`，`--color-highlight-shadow: transparent` ✅
- **mark 样式** `CardItem.tsx:34`：`rounded-[3px] px-[1px] bg-highlight text-highlight ring-1 ring-highlight-ring shadow-[0_0_0_2px_var(--color-highlight-shadow)]` ✅
- **WCAG AA 对比度**：暗色 #111111 on #fbbf24 = **11.31:1** ✅（≥4.5:1）；亮色 #451a03 on #fcd34d = **10.39:1** ✅（≥4.5:1）
- **可见性**：亮色深棕字+强描边（ring-amber-600/50）在纸面上可聚焦；暗色黑字+外发光（shadow amber-400/25）在深底最突出
- **结论**：PASS — 对比度远超 AA 标准，双主题配色方案落地完整

### P2-6 评分快捷键守卫
- **守卫位置** `page.tsx:441-442`：`if (detailId || showSettings) return` 在 keydown 监听首行
- **过滤顺序**：先检查 detailId/showSettings → 再检查 INPUT/TEXTAREA/BUTTON → 再检查修饰键 → 最后 `/^[0-5]$/` 匹配
- **依赖项** `page.tsx:462`：`useEffect` deps 包含 `detailId, showSettings`，弹窗状态变化时重新注册
- **结论**：PASS — 详情弹窗 / 设置弹窗打开时全局评分快捷键完全屏蔽，不会误触背景卡

### P2-7 空状态与离线态文案区分
- **serverOnline 状态机** `page.tsx:58`：`boolean | null`（null=连接中/迁移中，false=离线，在线）
- **connect 例程** `page.tsx:107`：useCallback 包裹，先关旧 EventSource 订阅再重连，「重试连接」按钮复用
- **离线横幅** `page.tsx:525-534`：`serverOnline === false` 时渲染 rust 横幅 + 「同步服务离线」+ 提示文案 + 重试按钮
- **连接中横幅** `page.tsx:536-540`：`serverOnline === null` 时渲染「正在连接同步服务…」
- **在线横幅** `page.tsx:541-543`：`serverOnline === true` 时渲染「已连接同步服务」
- **结论**：PASS — 空状态与离线态文案区分清晰，重试连接可用

### P3-4 Composer autoResize
- **ref** `Composer.tsx:24`：`taRef = useRef<HTMLTextAreaElement>(null)`
- **useEffect** `Composer.tsx:27-37`：`[text]` 依赖，先 `height: auto` 再按 `scrollHeight` 计算，maxRows=6（`lineHeight * 6 + paddingY`）
- **resize 控制** `Composer.tsx:93`：`resize-none`（由 autoResize 接管，用户不可手动拖高）
- **结论**：PASS — 粘贴长文自动展开至最大 6 行，不再需要手动拖高

### P3-5 导入成功/失败反馈加强
- **SkippedCard 类型** `storage.ts:120`：`{ title: string; reason: string }`
- **ImportResult** `storage.ts:122-124`：`skipped?: SkippedCard[]`
- **describeCardFailure** `storage.ts:43-60`：字段级原因（id/title/body/tags/rating/copyCount/code/thinkingSummary/notes/versions/createdAt/updatedAt）
- **parseMarkdownImport** `storage.ts:151-153`：正文为空 → `skipped.push({ title, reason: '正文为空' })`
- **parseImport JSON** `storage.ts:290-310`：部分导入——合法卡片入库，非法卡片入 skipped，全跳过时整体失败
- **handleImportFile** `page.tsx:423-431`：`skipped.length > 0` → notify 带 detail（成功 N 张 / 跳过 M 张 + 逐条原因），6s 展示
- **Toast** `Toast.tsx:3,13-21`：`detail?: string[]`，可滚动详情列表
- **结论**：PASS — 导入含非法卡时 Toast 显示成功/跳过数量及逐条原因，用户体验闭环

---

## 总验收 11合1 QA 记录（2026-08-27）

### P0-6 搜索高亮双主题配色二次优化
- **暗色** `globals.css:17-21`：`--color-highlight: #fbbf24`（amber-400），`--color-highlight-text: #111111`（ink-950），`--color-highlight-ring: rgba(252,211,153,0.6)`，`--color-highlight-shadow: rgba(251,191,36,0.25)` ✅
- **亮色** `globals.css:44-48`：`--color-highlight: #fcd34d`（amber-300），`--color-highlight-text: #451a03`（amber-950），`--color-highlight-ring: rgba(217,119,6,0.5)`，`--color-highlight-shadow: transparent` ✅
- **mark 样式** `CardItem.tsx:34`：`rounded-[3px] px-[1px] bg-highlight text-highlight ring-1 ring-highlight-ring shadow-[0_0_0_2px_var(--color-highlight-shadow)]` ✅
- **WCAG AA**：暗色 #111111 on #fbbf24 = 11.31:1 ✅；亮色 #451a03 on #fcd34d = 10.39:1 ✅

### P2-6 评分快捷键守卫
- **守卫** `page.tsx:577`：`if (detailId || showSettings) return` 在 keydown 监听首行 ✅
- **依赖** `page.tsx:597`：useEffect deps 包含 `detailId, showSettings` ✅

### P2-7 空状态与离线态文案区分
- **离线横幅** `page.tsx:687-696`：`serverOnline === false` → rust 横幅 + 重试按钮 ✅
- **连接中** `page.tsx:698-701`：`serverOnline === null` → 「正在连接同步服务…」✅
- **在线** `page.tsx:703-704`：`serverOnline === true` → 「已连接同步服务」✅

### P3-4 Composer autoResize
- **useEffect** `Composer.tsx:27-37`：`[text]` 依赖，`height: auto` → `scrollHeight` 计算，maxRows=6 ✅
- **resize-none** `Composer.tsx:93`：用户不可手动拖高 ✅

### P3-5 导入详情
- **SkippedCard** `storage.ts`：`{ title, reason }` 类型 ✅
- **handleImportFile** `page.tsx:550-566`：`skipped.length > 0` → Toast detail 列表 + 6s 展示 ✅
- **Toast** `Toast.tsx:35-43`：`detail?: string[]` 可滚动详情列表 ✅

### P2-1 版本节流验证
- **saveBodyOnly** `cards.ts`：`normalizeBody(newBody) === normalizeBody(c.body.trim())` 全等比较，失焦仅保存不建版 ✅
- **saveBodyWithVersion** `cards.ts`：手动保存/Ctrl+Enter 才调用，生成版本 ✅
- **PreviewPanel/CardDetail**：onBlur → `commitSave(true)` 但 `saveBodyWithVersion` 仅在显式保存时触发 ✅

### P2-5 撤销 10s
- **notifyWithUndo** `page.tsx:70-73`：`undoRef.current = undo` + `setToast({ msg, withUndo: true })` ✅
- **handleUndo** `page.tsx:75-80`：读 undoRef → 清空 → 调用 undo ✅
- **定时器** `page.tsx:84-85`：`toast.withUndo ? 10000`，到期清空 undoRef ✅
- **快照点**：删除单卡 `page.tsx:398`、清空仓库 `page.tsx:316`、载入示例 `page.tsx:298`、批量删除 `page.tsx:445-452`、导入覆盖 `page.tsx:541-565` ✅

### P2-11 批量多选
- **bulkIds** `page.tsx:61`：`ReadonlySet<string>` 状态 ✅
- **toggleBulk** `page.tsx:427-434`：add/delete 切换 ✅
- **CardItem** `CardItem.tsx:20-22,80-93`：`bulkSelected/bulkActive/onBulkToggle` + checkbox `role="checkbox"` + `aria-checked` ✅
- **批量操作栏** `page.tsx:644-669`：已选 N 张 + 打标签/打星/导出/删除/取消选择 ✅
- **handleBulkDelete** `page.tsx:437-453`：confirm + 撤销栈 ✅
- **handleBulkTag** `page.tsx:456-485`：prompt + parseTags + 追加去重 ≤3 ✅
- **handleBulkRate** `page.tsx:487-503`：prompt + 0-5 校验 ✅
- **handleBulkExport** `page.tsx:505-528`：筛选 → buildMarkdownExport → 下载 ✅

### P2-3 移动端抽屉
- **PreviewPanel** `PreviewPanel.tsx:314-315`：`card ? 'flex' : 'hidden md:flex'`；移动端 `fixed inset-x-0 bottom-0 z-30 max-h-[75dvh]` 底部抽屉 ✅
- **桌面端** `PreviewPanel.tsx:315`：`md:relative md:w-[var(--pw)] md:shrink-0` 侧边栏 ✅
- **关闭按钮** `PreviewPanel.tsx:326-330`：`onClose && md:hidden` 渲染收起按钮 ✅
- **resize 手柄** `PreviewPanel.tsx:324`：`hidden md:block` 桌面端可调宽 ✅

### P2-4 备注防丢
- **useEffect cleanup** `PreviewPanel.tsx:216-225`：卸载前 `clearTimeout(notesTimer)` + `commitSave(true, true)` flush ✅
- **外部数据覆盖** `PreviewPanel.tsx:155-158`：SSE/回滚前 `clearTimeout(notesTimer)` + `commitSave(true)` ✅
- **CardDetail** `CardDetail.tsx:76,145-146,156,166`：同样的 notesTimer 清理模式 ✅

### P3-2 版本 diff
- **VersionDiff** `VersionDiff.tsx`：`lineDiff(a, b)` LCS 行级 diff，del 红色 `−`，add 金色 `+`，same 灰色 ✅
- **diff.ts** `lib/diff.ts`：`lineDiff` LCS DP（O(n·m)，版本≤10，开销可忽略）✅
- **PreviewPanel** `PreviewPanel.tsx:419-433`：版本行「点击查看完整内容 / diff」展开 → `<VersionDiff>` ✅
- **CardDetail** `CardDetail.tsx:516-539`：同上 ✅

### 既有回归
- P0-4/P0-5 已 CLOSED：confirmDelete 链路 + 主题切换 ✅
- P2-8/P2-9/P3-6 已 CLOSED：搜索相关度 / 标签删除 × / 左对齐 ✅
- API `/api/sync` 正常返回 ✅
- tsc --noEmit 零错误 ✅
- npx eslint src/ 零错误 ✅

---

## P0-6/P0-7 QA 记录（2026-08-28，2合1）

### P0-6 高亮关键字遮挡重开整改
- **根因修复** `globals.css:101-110`：`mark` 规则 `color: var(--color-highlight-text)` — 此前误用 `text-highlight`（Tailwind 解析为 `--color-highlight` 琥珀色，与背景同色导致文字完全遮挡），现固定取 `--color-highlight-text`（亮=深棕 #451a03 / 暗=黑 #111）✅
- **暗色变量** `globals.css:18-21`：`--color-highlight: #fbbf24`（amber-400 实底）/ `--color-highlight-text: #111111`（黑字）/ `--color-highlight-ring: rgba(252,211,77,0.6)` / `--color-highlight-shadow: rgba(251,191,36,0.25)` ✅
- **亮色变量** `globals.css:45-48`：`--color-highlight: #fcd34d`（amber-300）/ `--color-highlight-text: #451a03`（深棕）/ `--color-highlight-ring: rgba(217,119,6,0.5)` / `--color-highlight-shadow: transparent` ✅
- **亮色半透明** `globals.css:111-113`：`html.light mark { background: color-mix(in srgb, var(--color-highlight) 50%, transparent) }` — 50% 透明叠纸面，文字不被遮挡 ✅
- **mark 样式** `globals.css:101-110`：`border-radius: 3px` + `padding-inline: 1px` + `font-weight: 500` + ring + shadow 全走变量 ✅
- **CardItem** `CardItem.tsx:37`：`<mark key={idx}>{text.slice(...)}</mark>` 干净，无内联样式，全靠 CSS 变量驱动 ✅
- **WCAG AA**：暗色 #111111 on #fbbf24 = **11.3:1** ✅；亮色 #451a03 on 半透明 #fcd34d ≈ **12.5:1** ✅（均 ≥4.5:1）
- **对比旧方案**：旧 `text-highlight` → `--color-highlight`（琥珀色）= 文字与背景同色 → 完全遮挡；现 `--color-highlight-text`（黑/深棕）= 强对比 → 文字清晰可读

### P0-7 卡片空白回收
- **操作列悬浮胶囊** `CardItem.tsx:77-126`：`absolute right-2 top-2 z-10` + `bg-ink-900/80 backdrop-blur-sm` + `border-line/70` + `shadow-lg`，不占文档流 ✅
- **显隐逻辑** `CardItem.tsx:80`：`bulkActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'` — hover/focus-within/bulkActive 三态显隐 ✅
- **正文行数** `CardItem.tsx:129`：`line-clamp-3`（原 line-clamp-2 → 3 行），正文可视行 1→2-3 ✅
- **标题 pr-16** `CardItem.tsx:58`：`pr-16` 预留胶囊位，code 徽标不被盖住 ✅
- **胶囊内容** `CardItem.tsx:83-124`：checkbox（bulkToggle）+ 编辑 + 删除，纵向排列，`gap-0.5` 紧凑 ✅
- **readonly 不渲染** `CardItem.tsx:77`：`!readonly && (...)` — demo 视图无胶囊 ✅
- **卡片布局** `CardItem.tsx:52`：`flex flex-col gap-2.5` — 释放右侧空间后中间正文区自动填充，空白回收 ✅

### 既有回归
- tsc --noEmit 零错误 ✅
- npx eslint src/ 零错误 ✅
- P0-4/P0-5/P2-6/P2-7/P3-4/P3-5/P2-1/P2-5/P2-11/P2-3/P2-4/P3-2 已 CLOSED ✅

---

## P0 标签系统 22 项 QA 记录（2026-08-28）

### 1. 创建标签（管理区+编辑时隐式创建）
- **管理区** `page.tsx:502-514`：`handleCreateTag(name, parentId)` → 空名校验 + 50 字上限 + `isNameUnique` 同父重名检测 + `assertNoCycle` + `createTag` ✅
- **隐式创建** `page.tsx:317-335`：`resolveTagIds(names)` → 未找到时 `createTag(nextTags, name, null)` 自动新建顶级标签 ✅
- **TagPanel 新建入口** `TagPanel.tsx:417-429`：「+」按钮 → `handleCreate(null)`；菜单「＋ 新建子标签」→ `handleCreate(tag.id)` ✅

### 2. Prompt 多标签
- `Card.tags: string[]`（types.ts:11）+ `setCardTags` 原子替换（tags.ts:234-240）+ resolveTagIds 支持多名称 ✅
- 上限 3 个保持（`cards.ts:108` slice(0,3)），待产品决策放开 ✅

### 3. 标签树（展开/记忆/选中/搜索）
- **树渲染** `TagPanel.tsx:135-257`：`TreeNode` 递归渲染 + `childrenOf` 子级获取 ✅
- **展开/收起** `TagPanel.tsx:276-284`：`toggle(id)` + `localStorage[pm:tag-expanded]` 记忆（`readExpanded`/`writeExpanded`） ✅
- **选中高亮** `TagPanel.tsx:154,162-163`：`active = selected === tag.id` + `bg-gold/10` ✅
- **搜索** `TagPanel.tsx:290-300`：匹配 name 或完整路径（`tagPath`），命中平铺展示完整路径 ✅

### 4. 数量（直接/总）
- **TreeNode** `TagPanel.tsx:155-157`：`direct = directCount(promptTags, tag.id)` + `totalCount(promptTags, subIds)` ✅
- **标题提示** `TagPanel.tsx:201`：`direct !== total` 时显示「直接 X · 含子 Y」 ✅

### 5. 点击筛选（含父含子去重）
- `page.tsx:266-268`：`subIds = [selectedTag, ...collectDescendantIds]` → `collectTagPromptIds` 去重 → `matched.has(c.id)` ✅
- 含子标签：`collectDescendantIds` 递归收集所有后代 id ✅
- 去重：`collectTagPromptIds` 用 `Set<prompt_id>` 去重 ✅

### 6. 加/移除标签（chip × + datalist 补全）
- **CardDetail** `CardDetail.tsx:366`：chip × → `setDraft(tagsText: next.join('、'))` 移除 ✅
- **CardDetail** `CardDetail.tsx:386-390`：`<datalist id="detail-tags-list">` + `existingTags` 补全 ✅
- **PreviewPanel** `PreviewPanel.tsx:486-490`：同上 datalist ✅
- **PreviewPanel** `PreviewPanel.tsx:525`：chip × 移除 ✅

### 7. 重命名（含父重命名子路径自动变）
- `handleRenameTag`（page.tsx:517-533）：空名校验 + 50 字上限 + `isNameUnique` 重名检测 + `renameTag` 仅改 Tag.name ✅
- `syncCardsToPromptTags`（page.tsx:530）：重命名后同步重建 Card.tags 冗余字段 ✅
- 子路径自动变：`tagPath`（tags.ts:111-124）动态计算，父名变 → 所有子路径自动更新 ✅

### 8. 移动/拖动 + 防循环/同父重名
- `handleMoveTag`（page.tsx:536-549）：`assertNoCycle` 三重检测 + `isNameUnique` 同父重名检测 ✅
- `assertNoCycle`（tags.ts:94-108）：① 不能成为自己的父 ② 不能移到自己的子节点 ③ 成环检测 + visited 兜底 ✅
- `moveTag`（tags.ts:196-199）：仅改 parent_id，关系不动 ✅

### 9. 删除（两种模式 + 绝不删 Prompt + 确认）
- `handleDeleteTag`（page.tsx:553-560）：`deleteTag(tags, promptTags, id, mode === 'subtree')` + `applyTags` 原子落盘 ✅
- **两种模式** `TagPanel.tsx:400-408`：`hasKids` 时二次 confirm → `'self'`（子标签提升一级）或 `'subtree'`（删除整棵子树） ✅
- **绝不删 Prompt** `deleteTag`（tags.ts:229）：`nextPromptTags = promptTags.filter(rt => !removedIds.has(rt.tag_id))` — 只删关系不删卡 ✅
- **确认** `TagPanel.tsx:388-398`：首次 confirm 含使用数量 + 删除后果说明 ✅

### 10. 无标签
- `UNTAGGED` 虚拟 id（TagPanel.tsx:8）+ `untaggedCount`（page.tsx:248-251）：`sourceCards.filter(c => !linked.has(c.id)).length` ✅
- `baseCards`（page.tsx:262-264）：`selectedTag === UNTAGGED` → 无关联 prompt 的卡片 ✅
- TagPanel 渲染（TagPanel.tsx:512-526）：底部「无标签」入口 ✅

### 11. 当前标签下新建继承
- `page.tsx:360-362`：`selectedTag && selectedTag !== UNTAGGED && !isDemoView` → `selName` 强制首位 → `resolveTagIds` ✅
- 「全部」下不强制：条件 false 时维持原 AI tags ✅
- demo 视图不继承：`!isDemoView` ✅

### 12. 外键安全（Tag 删→PromptTag 级联，绝不删卡）
- `deleteTag`（tags.ts:229）：`nextPromptTags = promptTags.filter(rt => !removedIds.has(rt.tag_id))` — 级联删关系 ✅
- 卡片总数 32→32 不变（CURRENT_STAGE 手测验证） ✅

### 13. 事务/原子操作
- `applyTags`（page.tsx:338-342）：`setTags` + `setPromptTags` + `syncCardsToPromptTags` 一次性原子替换 ✅
- `setCardTags`（tags.ts:234-240）：`[...filtered, ...unique]` 原子替换某 prompt 全部标签关系 ✅

### 14. isTag/isPromptTag 守卫
- `isTag`（tags.ts:14-27）：校验 id/name/parent_id/icon/is_pinned/sort_order/created_at/updated_at ✅
- `isPromptTag`（tags.ts:29-33）：校验 prompt_id/tag_id ✅

### 15. buildTagTree 树构建
- `buildTagTree`（tags.ts:264-320）：按 parent_id 分组 → 递归 walk → sort_order + locale 排序 → 环引用兜底孤儿追加 ✅
- `TagNode`（tags.ts:255-261）：extends Tag + total/direct/depth ✅

### 16. deriveTagsFromCards 兜底派生
- `deriveTagsFromCards`（tags.ts:331-361）：从 Card.tags 去重派生临时 tags + promptTags（id = tag_derive_N） ✅
- demo 视图 + 未迁移旧数据兜底 ✅

### 17. tagPath 完整路径
- `tagPath`（tags.ts:111-124）：从 tagId 沿 parent_id 链向上收集 → `unshift` → `join(' / ')` ✅

### 18. syncCardsToPromptTags 冗余同步
- `syncCardsToPromptTags`（tags.ts:174-180）：以 promptTags 为真源重建 Card.tags，仅变化时生成新对象 ✅

### 19. normalizeTag 归一化
- `normalizeTag`（tags.ts:36-44）：老数据缺 icon/is_pinned/sort_order 时补默认值 ✅

### 20. 迁移脚本
- `scripts/migrate-tags.mjs`：dry-run + --apply + 自动 .bak 备份 + validate ✅
- 脏数据合并：多age×3 + 多aengt编程×1 → 多agent编程；删除无法分类 ✅

### 21. API 透传
- `api/sync/route.ts:27`：`tags` + `promptTags` 字段透传 ✅
- `curl /api/sync`：`cards=32 tags=11 promptTags=55 version=529` ✅

### 22. serverStore 守卫
- `serverStore.ts`：`setState` 落盘前 `isTag/isPromptTag` 过滤非法数据 + 完整性校验（无孤儿/唯一约束/环） ✅

### 既有回归
- tsc --noEmit 零错误 ✅
- npx eslint src/ 零错误 ✅
- API `/api/sync` cards=32 tags=12（含测试标签「编程」）promptTags=55 ✅
- P0-6/P0-7 已 CLOSED ✅

---

## 新增 Bug

### BUG-NEW-1：chip × 移除标签时 card.tags 未同步（P1）

- **发现日期**：2026-08-28（真机复测第十三次）
- **严重程度**：P1（功能 Bug，影响数据一致性）
- **复现步骤**：
  1. 打开卡片「定点读取文档策略」（有 3 个标签：开发恢复、经验记录、token经济学）
  2. 在详情面板点击「经验记录」的 × 按钮
  3. 观察：标签面板「经验记录」count 从 5 降到 4（移除生效）
  4. 但 API 返回该卡 `tagIds: []` + `promptTags: []`（全部标签被清空）
  5. UI 仍显示 3 个 chip（使用旧 card.tags 渲染）
- **根因**：`handleUpdateMeta`（page.tsx:453-458）在 `setCards` 时只更新 `title` 和 `updatedAt`，**未将新 tagNames 同步到 `card.tags` 字段**
- **影响**：
  1. `card.tags`（冗余字段）与 `promptTags`（关系真源）不一致
  2. UI 渲染 chip 使用过期 `card.tags`，移除后仍显示旧 chip
  3. push 到服务端的 card 对象携带过期 `tags` 字段
  4. 远端设备通过 SSE 接收到不一致数据
- **对比**：其他标签变更路径（handleDeleteTag、handleRenameTag、handleBulkTag）都正确调用了 `syncCardsToPromptTags`，唯独 `handleUpdateMeta` 遗漏
- **修复方向**：`handleUpdateMeta` 的 `setCards` updater 中加入 `tags: tagNames`，确保 `card.tags` 与 `promptTags` 双写一致
- **相关代码**：
  - `src/app/page.tsx:453-458` — handleUpdateMeta（bug 所在）
  - `src/app/page.tsx:455` — 遗漏 tags 的 setCards 更新
  - `src/components/CardDetail.tsx:363-367` — chip × onClick
  - `src/components/PreviewPanel.tsx:522-526` — chip × onClick
  - `src/lib/tags.ts:234-240` — setCardTags
- **状态**：CLOSED（已修复 2026-08-28，第十四次 Fix QA 验证通过）

---

## Fix QA 记录

### 第十四次 Fix QA（2026-08-28 - chip 移除同步 + 重命名回滚 + 新建父校验）

- **模式**：QA Acceptance（真机 Orca Computer Use + 代码走查 + API 校验）
- **执行者**：QA / Test Agent
- **结果**：**PASS**（3 项验证全部通过）
- **构建门禁**：tsc --noEmit ✅、npm run lint ✅

#### 验证结果

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | chip × 移除同步 | ✅ PASS | BUG-NEW-1 已修复：card.tags 与 promptTags 双写一致，chip 消失 + API 同步 |
| 2 | 重命名回滚 | ✅ PASS | handleRenameTag 调用 syncCardsToPromptTags，无回滚，schedulePush 宏任务合并正常 |
| 3 | 新建标签父校验 | ✅ PASS | page.tsx:508-509 返回「父标签不存在」（非环检测） |

#### BUG-NEW-1 状态更新

- **状态**：**CLOSED**（已修复）
- **修复内容**：`handleUpdateMeta`（page.tsx:453-466）改为调用 `syncCardsToPromptTags` 重建 card.tags，确保与 promptTags 双写一致
- **真机验证**：chip × 移除后 TagPanel count -1 + chip 消失 + API card.tags 同步 + promptTags 同步

#### handleCreateTag 修复确认

- **状态**：已修复 ✅
- **变更**：page.tsx:508-509 从 `assertNoCycle` 改为 `tags.some((t) => t.id === parentId)`
- **错误提示**：「父标签不存在」（非「父标签不合法」或环检测错误）
- **真机验证**：代码走查确认，UI 路径无法触发非法父 ID

---

### 第十五次 QA - P0-9 标签添加交互重构（#标签+回车/空格自动添加，禁止逗号分隔，2026-08-27 真机验收）

- **日期**：2026-08-27
- **模式**：QA Acceptance（Token 高效版，真机 agent-browser GUI）
- **执行者**：QA / Test Agent
- **范围**：P0-9 标签添加交互重构（PRODUCT_BACKLOG.md P0-9，2026-08-28 用户截图反馈的子项）
- **结果**：**ALL PASS**（6 项功能点 + 2 条构建门禁全过，无新增 Bug）
- **构建门禁**：`npx tsc --noEmit` ✅ 0 错误、`npm run lint` ✅ 0 错误
- **API 验证**：未单独 curl（本次仅 UI 交互，侧边栏全局标签计数实时同步已隐式证明 onUpdateMeta 链路 + SSE 落盘正常）
- **commit 验证**：未提交（验收完成后停止，等待【节奏】触发产品验收）
- **已关闭**：无新增关闭
- **阻断项**：无
- **真机截图**：`/Users/zzymima0000/.agent-browser/tmp/screenshots/screenshot-1787842880209.png`（详情面板"添加标签"标题样式 + chip 区域）
- **定点读取**（不扫全仓）：`docs/review/PRODUCT_BACKLOG.md:33-44` P0-9 段 + `src/components/TagEditor.tsx`（174 行，全读）+ `src/components/CardDetail.tsx` line 8/123/200/348-361（TagEditor 使用处 + onChange 链路）+ `src/components/PreviewPanel.tsx` line 9/196/268/477-490（同上）+ `src/lib/cards.ts:100-114`（`parseTags` `[,，、\s]+` 分割与 `join('、')` 兼容）

#### 6 项验证逐条

| # | 测试项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 输入 `#标签名` + 回车 → 自动添加为 chip（不依赖逗号） | ✅ PASS | CardDetail 输入 `#qa验收` + Enter → chip 立即出现，侧边栏新增"qa验收 1"（全局同步） |
| 2 | 输入时弹出已有标签下拉补全，点选即添加 | ✅ PASS | 输入 `#qa` → 下拉出现"qa基线"建议项（"qa验收"因已在 chips 被正确过滤），点选即添加 |
| 3 | 每次只添加一个标签，多标签独立 | ✅ PASS | 经验记录 + sop 初始 → 添加 qa验收（sop 保留）→ 移除 sop → 添加 qa基线（经验记录+qa验收 保留）→ 共 3 chip 互不影响 |
| 4 | chip 可点击 × 移除单个标签 | ✅ PASS | `aria-label="移除标签 sop"` 按钮点击后移除按钮数 3→2，侧边栏"qa基线"从 7→8 反向验证持久化 |
| 5 | 标题"添加标签"样式：居中、加粗/加大、与其他区域区分 | ✅ PASS | 截图确认：`<div className="text-center">` + `font-serif text-sm font-semibold text-paper` 与上下"标题""调取码"label（左对齐 text-xs text-muted）对比明显区分 |
| 6 | 与 `handleUpdateMeta` 的 `tagsText` 编辑链路兼容 | ✅ PASS | 关闭详情重开 → 3 个 chip 全部保留；`parseTags(/[,，、\s]+/)` 与 `join('、')` 双向兼容；侧边栏全局统计实时同步证明 `onUpdateMeta(id, title, parseTags(tagsText))` 路径正常 |

#### 补充验证

- **CardDetail 路径**：`CardDetail.tsx:356-359` onChange 同时 `setDraft(tagsText=join('、'))` + `onUpdateMeta(id, title, nextTags)`，双轨写入与 `commitSave` 路径（line 123 `parseTags(d.tagsText)`）格式一致 ✅
- **PreviewPanel 路径**：`PreviewPanel.tsx:485-488` 同款 onChange 双轨写入；PreviewPanel 实测空格键添加：输入 `#新标签` + Space → chip 立即出现（侧边栏新增"新标签 1"）✅
- **atMax 行为**：3 chip 时 input 区显示"已达上限（最多 3 个）"红色提示，下拉 `!atMax` 不渲染（TagEditor.tsx:144），行为合理 ✅
- **失焦兜底**：`onBlur`（TagEditor.tsx:113-117）有未输入完的 input 时 `addTag(input)`，避免残留文字，符合 flomo 风格 ✅
- **下拉键盘导航**：Enter（高亮项或 input）/ Space / ArrowUp / ArrowDown / Escape 全部实现（TagEditor.tsx:118-139），高亮态用 `bg-ink-800 text-paper` 视觉反馈 ✅
- **下拉 mousedown preventDefault**（TagEditor.tsx:147）：防止 suggestion 点击触发 input blur 抢先提交，回退走 `addTag(s)` ✅

#### 观察项（不阻断，建议 P2/Future 评估）

- **输入法兼容性**：中文拼音输入法确认候选词时按空格，部分浏览器/输入法下可能触发 `onKeyDown` `e.key === ' '` 且 `e.nativeEvent.isComposing === true`，当前代码未加 `if (e.nativeEvent.isComposing) return` 守卫，可能误触发 addTag 提早锁定。Chrome 主流组合下 key 为 `'Process'` 不会命中空格分支，但稳妥做法应加守卫。**不阻断验收**（极端边界场景）。
- **onBlur 兜底** 残留文字提交：用户输入"标签"后未按回车/空格直接失焦也会 addTag，符合 flomo 风格但需用户留意；可接受。
- **"添加标签"标题字号**：当前 `text-sm`（14px），对比其他 label `text-xs`（12px）已区分明显但仅大一档；如用户希望更夸张可升 `text-base`（16px）— 依赖用户偏好确认。**不阻断验收**。

#### 既有回归

- P0-1~P0-7（含 11合1 总验收 + 2合1）：本轮未触碰相关代码，路径不变 ✅
- 失焦自动保存：测试过程中"已自动保存"角标持续显示，未出现丢稿 ✅
- 同步链路：sop 计数从 3→2、qa基线 7→8、qa验收 0→1、+新标签 1，均为失焦即落库并 SSE 推送，无回声刷新现象 ✅
- 新增 BUG：无

---

## P1 打包验证（2026-08-28，第十六次）

- **日期**：2026-08-28
- **模式**：QA Acceptance（代码走查 + 构建门禁）
- **执行者**：QA / Test Agent
- **范围**：P1-1 / P1-2 / P1-3 / P1-4 四项打包验证
- **结果**：**ALL PASS**（4 项全通过，无新增 Bug）
- **构建门禁**：`npx tsc --noEmit` ✅ 0 错误、`npm run lint` ✅ 0 错误
- **commit 验证**：未提交

### P1-1 TagPanel 底部文案与同步架构一致

- `TagPanel.tsx:530-534`：底部文案根据 `offline` prop 分支渲染
  - 在线态：`已开启局域网实时同步（服务端共享存储），离线时回退本机缓存`
  - 离线态：`未连接同步服务，已使用本机本地数据`
- 文案与 README / HANDOFF / CURRENT_STAGE 所述"服务端 data/store.json 为同步源 + localStorage 仅作离线兜底 + SSE 实时同步"一致
- **结论**：PASS ✅

### P1-2 关闭/切卡不再静默丢稿

- `CardDetail.tsx:155-160`：`handleClose()` 先 `clearTimeout(notesTimer)` + `commitSave(true)` flush 未保存草稿，再调 `props.onClose()`
- `CardDetail.tsx:143-153`：useEffect cleanup 兜底 flush（覆盖非关闭按钮的外部卸载路径）
- `PreviewPanel.tsx:150-163`：`[card]` useEffect 在外部数据覆盖草稿前先 `clearTimeout(notesTimer)` + `commitSave(true)`，再 `setDraft(cardDraftFrom(card))`
- `PreviewPanel.tsx:216-226`：useEffect cleanup 兜底 flush + clearTimeout + abort AI 请求
- `PreviewPanel.tsx:232-237`：`handleClose()`（移动端抽屉收起）先 flush 再关闭
- 备注定时器 700ms 防抖在所有卸载/切换路径均被 clearTimeout 清理
- **结论**：PASS ✅

### P1-3 导入选择器支持 .md

- `TopBar.tsx:70`：`accept=".json,.md,application/json,text/markdown"` — 支持 JSON 与 Markdown
- `TopBar.tsx:63`：`title="导入备份（支持 JSON 与 Markdown）"` — 按钮 hover 提示明确
- 文件选择器可同时选中 `.json` 和 `.md` 文件
- **结论**：PASS ✅

### P1-4 调取码冲突语义统一

- **PreviewPanel.tsx:179,198-199,205-206**：冲突时跳过 code 字段 `if (changes.codeChanged && !conflict) onUpdateCode(...)`，其余字段照存，toast `调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试`
- **CardDetail.tsx:106,125-126,131-133**：完全一致的策略 — 冲突时跳过 code，其余照存，同一 toast 文案
- **allCodes 来源**：page.tsx:253-256 统一计算 `cards.map(c => c.code).filter(Boolean)`，两个组件接收相同的 allCodes prop
- 两处 saveThrough 函数逻辑完全对齐：冲突检测 → 跳过 code → 保存其余 → toast 提示
- **结论**：PASS ✅

### 既有回归

- P0-1~P0-7（含 11合1 总验收 + 2合1）：本轮未触碰相关代码，路径不变 ✅
- P0 标签系统 22 项：本轮未触碰相关代码，路径不变 ✅
- BUG-NEW-1（chip 移除双写）：仍 CLOSED ✅
- tsc --noEmit 零错误 ✅
- npm run lint 零错误 ✅

---

## P2-10/P2-11 网格直删入口 + 批量管理 QA 记录（2026-08-28）

- **日期**：2026-08-28
- **模式**：QA Acceptance（真机 Orca Computer Use 操作 + 代码走查）
- **执行者**：QA / Test Agent
- **范围**：P2-10 网格直删入口 + P2-11 批量管理
- **结果**：**ALL PASS**（12 项验证全通过，无新增 Bug）
- **构建门禁**：tsc --noEmit ✅ 0 错误、npm run lint ✅ 0 错误
- **API 验证**：curl /api/sync 正常（卡片数从 33 → 32）
- **commit 验证**：未提交

### P2-10 网格直删入口验证

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | 删除按钮可见性 | ✅ PASS | CardItem hover 时显示删除按钮（text-rust 样式），位于编辑按钮下方 |
| 2 | 删除确认对话框 | ✅ PASS | 点击删除按钮弹出 confirm「确定删除「{title}」？此操作不可撤销。」|
| 3 | 删除后卡片移除 | ✅ PASS | 确认后卡片被移除，总数从 33 → 32 |
| 4 | demo 视图不显示删除按钮 | ✅ PASS | isDemoView 时 onDelete prop 不传递，CardItem 不渲染删除按钮 |

### P2-11 批量管理验证

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 5 | 多选框可见性 | ✅ PASS | 卡片 hover 时出现 checkbox（role="checkbox" aria-checked）|
| 6 | 批量选择功能 | ✅ PASS | 点击 checkbox 选中卡片，批量操作栏出现「已选 1 张」|
| 7 | 批量操作栏 | ✅ PASS | 显示打标签/打星/导出/删除/取消选择按钮 |
| 8 | 批量删除确认 | ✅ PASS | 点击删除按钮弹出 confirm「确定删除选中的 1 张卡片？此操作不可撤销。」|
| 9 | 批量删除执行 | ✅ PASS | 确认后卡片被移除，总数从 33 → 32 |
| 10 | 批量删除撤销 | ✅ PASS | notifyWithUndo 显示「已删除 1 张卡片」+ 撤销按钮，10s 内可恢复 |
| 11 | 取消选择 | ✅ PASS | 点击「取消选择」按钮清空 bulkIds，批量操作栏消失 |
| 12 | 批量打标签/打星/导出 | ✅ PASS | 代码走查确认：handleBulkTag/handleBulkRate/handleBulkExport 逻辑正确 |

### 既有回归

- P0-4/P0-5/P2-6/P2-7/P3-4/P3-5/P2-1/P2-5/P2-3/P2-4/P3-2 已 CLOSED ✅
- P0 标签系统 22 项：未触碰相关代码 ✅
- BUG-NEW-1（chip 移除双写）：仍 CLOSED ✅
- tsc --noEmit 零错误 ✅
- npm run lint 零错误 ✅

### 结论

P2-10 网格直删入口 + P2-11 批量管理 12 项验证全通过，无新增 Bug。删除路径从 3 步降到 2 步，批量管理功能完整可用。

---

## P0-A 安全闭环 QA 记录（2026-08-28）

- **日期**：2026-08-28（P0-A 高影响标签操作安全闭环验收）
- **模式**：QA Acceptance（代码走查 + 构建验证）
- **执行者**：QA / Test Agent
- **范围**：P0-A 安全闭环 4 项（影响数展示 / 10s 撤销 / 服务端校验 / 版本号提交）
- **结果**：**ALL PASS**（4 项验证全通过，无新增 Bug）
- **构建门禁**：tsc --noEmit ✅ 0 错误、npm run lint ✅ 0 错误

### P0-A 验证结果（4 项）

| # | 测试项 | 结果 | 说明 |
|---|---|---|---|
| 1 | 标签删除前展示影响数 | ✅ PASS | `TagPanel.tsx:384-397` — `useCount = totalCount(promptTags, new Set([tag.id, ...collectDescendantIds(tags, tag.id)]))`，confirm 显示「当前有 N 条提示词使用此标签（或其子标签）」；子标签名称以顿号分隔列出（`childrenOf().map(c=>c.name).join('、')`），Prompt 影响数准确 |
| 2 | 10 秒撤销恢复 | ✅ PASS | `page.tsx:357-365` capture/restoreTagSnapshot 缓存 {cards, tags, promptTags}；`page.tsx:565-617` 四项标签 CRUD（create/rename/move/delete）均调 `notifyWithUndo`；`page.tsx:98-107` `toast.withUndo ? 10000 : ...` 定时 10s；`page.tsx:91-96` handleUndo 执行快照回退；toast 内渲染「撤销」按钮 |
| 3 | 服务端校验 5 项 | ✅ PASS | `tags.ts:187-226` validateTagGraph ① 同父无重名（`parent_id\u0000name` 去重）② id 唯一（`byId.size !== tags.length`）③ 父级存在（`byId.has(parent_id)`）④ 无环（父链 while 遍历检测 guard）⑤ 关联不悬空（`byId.has(rt.tag_id)` + `cardIds.has(rt.prompt_id)`）⑥ `(prompt_id, tag_id)` 唯一（seen Set）；`serverStore.ts:68-80` setState 落盘前调用，失败返回 `{ ok: false, error }`；`storage.ts:462-477` sanitizePromptTags 客户端自愈悬空/重复关联 |
| 4 | 带版本号提交 | ✅ PASS | `serverStore.ts:98-104` 若 `baseVersion !== s.version` 返回 `{ ok: false, error, conflict: true }`；`storage.ts:525-531` pushToServer 发送 `baseVersion: knownVersion`；`storage.ts:423-434` doPush 冲突时 loadFromServer 刷新 + onConflictRefresh 回调；`page.tsx:214-223` 注册冲突回调 → setCards/setTags/setPromptTags + notify「检测到其他设备更新了数据，已刷新至最新版本，请重试刚才的操作」；`serverStore.ts:110` 成功写入 version += 1；SSE `lastPushedVersion` 回声过滤（`storage.ts:576`） |

### 代码走查细节

**1. 影响数展示（TagPanel.tsx:384-411）**
- L386: `useCount = totalCount(promptTags, new Set([tag.id, ...collectDescendantIds(tags, tag.id)]))` — 含子标签的去重 Prompt 数
- L388-397: 多行 confirm 文案，包含 `当前有 ${useCount} 条提示词使用此标签（或其子标签）`
- L400-408: 有子标签时二次 confirm 列出子标签名，模式选择「删除整棵子树 / 仅删自身」
- tags.ts:133-145 totalCount 使用 `collectTagPromptIds` 去重 Set.size 保证准确

**2. 10s 撤销闭环（page.tsx:78-107, 357-365, 555-617）**
- L78: undoRef 存储回调
- L85-89: notifyWithUndo 设置 undoRef + withUndo:true
- L91-96: handleUndo 执行并清空
- L98-107: useEffect withUndo → 10000ms 定时清空
- L357-365: captureTagSnapshot / restoreTagSnapshot 原子回退三集合
- L565-568 create / L583-587 rename / L602-604 move / L613-617 delete — 全部 snapshot + notifyWithUndo

**3. 服务端校验三层防御**
- Layer 1: isTag/isPromptTag 守卫过滤非法结构（serverStore.ts:37-38）
- Layer 2: validateTagGraph 在 setState 落盘前执行 5 项检查（serverStore.ts:77-79）
- Layer 3: 版本冲突检测 baseVersion 比对（serverStore.ts:98-104）
- 客户端: sanitizePromptTags 自愈悬空/重复关联再推送（storage.ts:462-477）

**4. 版本号提交闭环**
- GET /api/sync 返回 version（route.ts:18）
- POST /api/sync 透传 baseVersion 到 setState（route.ts:37）
- serverStore setState: 内容无变 → 不落盘不广播（L94-96）；baseVersion 落后 → reject + conflict:true（L99-104）
- storage pushToServer: 发送 baseVersion: knownVersion（L531）
- storage doPush: 冲突时 loadFromServer 刷新 → onConflictRefresh 回调（L426-433）
- page.tsx: setConflictRefreshHandler 注册回调，重载三集合 + notify（L214-223）
- SSE echo filter: lastPushedVersion 匹配时跳过（storage.ts:576）

### 既有回归

- P2-10/P2-11 网格直删+批量管理：已 CLOSED ✅
- P0 标签系统 22 项：未触碰相关代码 ✅
- BUG-NEW-1（chip 移除双写）：仍 CLOSED ✅
- tsc --noEmit 零错误 ✅
- npm run lint 零错误 ✅

### 结论

P0-A 安全闭环 4 项验证全通过，无新增 Bug。标签操作的安全性从「无防护」升级为「影响数可见 + 10s 可撤销 + 服务端 5 项校验 + 版本冲突拒绝刷新重试」完整闭环。

## 第十八次 QA - P0-B 标签合并与批量移除 + P0-C 可组合标签筛选 + P0-8 标签体系完善（2026-08-28）

- **时间**：2026-08-28
- **范围**：P0-B 标签合并与批量移除 + P0-C 可组合标签筛选 + P0-8 标签体系完善
- **测试环境**：localhost:3000，Playwright 自动化测试
- **测试结果**：PASS
- **测试详情**：
  1. **P0-B 标签合并功能**：
     - mergeTags 函数实现正确：迁移源标签关联到目标标签、自动去重、删除源标签、绝不删除 Prompt ✅
     - handleMerge 函数实现正确：支持完整路径消歧，同名时提示输入完整路径 ✅
     - handleBulkRemoveTag 函数实现正确：支持完整路径匹配，移除所有同名标签关系 ✅
     - TagEditor 标签上限更新正确：从 3 改为 10，对旧数据/创建/编辑/批量操作统一处理 ✅
  2. **P0-C 可组合标签筛选功能**：
     - 筛选条件组 UI 实现正确：支持 OR/AND/NOT 三种模式 ✅
     - 包含子标签开关实现正确：控制是否包含子标签进行筛选 ✅
     - 与全文搜索、@调取码搜索叠加使用正确 ✅
     - 支持添加、删除、重置筛选条件 ✅
  3. **P0-8 标签体系完善功能**：
     - handleRenameTag 函数实现正确：重命名时自动修正所有关联卡片的标签 ✅
     - applyTags 函数实现正确：调用 syncCardsToPromptTags 重建 Card.tags 冗余字段 ✅
- **技术验证**：
  - TypeScript 检查：0 错误 ✅
  - Lint 检查：0 错误 ✅
  - 构建检查：通过 ✅
- **结论**：P0-B/P0-C/P0-8 功能实现正确，测试通过，无新增 Bug

## 第十九次 QA - P0-9 标签添加交互重构（#标签+回车/空格自动添加，禁止逗号分隔，2026-08-28）

- **时间**：2026-08-28
- **范围**：P0-9 标签添加交互重构
- **测试环境**：localhost:3000，Playwright 自动化测试
- **测试结果**：PASS
- **测试详情**：
  1. **标签添加交互重构**：
     - #标签+回车/空格自动添加功能实现正确 ✅
     - 禁止逗号分隔功能实现正确 ✅
     - 用户输入体验优化正确 ✅
- **技术验证**：
  - TypeScript 检查：0 错误 ✅
  - Lint 检查：0 错误 ✅
  - 构建检查：通过 ✅
- **结论**：P0-9 功能实现正确，测试通过，无新增 Bug

## 第二十次 QA - P0-H MCP 连接一键复制提示词（2026-08-28）

- **时间**：2026-08-28
- **模式**：QA Acceptance（代码走查 + 真机 Orca Computer Use + 剪贴板核验）
- **范围**：SettingsModal MCP 三场景说明、构建命令复制、完整 AI 代理提示词复制
- **测试环境**：Chrome + `http://localhost:3000`，macOS 真机；MCP 子包 TypeScript 构建
- **结果**：**ALL PASS**（4 项需求全通过，无新增功能 Bug）

### 验证结果

1. **三个场景**：设置弹窗真实展开后可见 GPT、WorkBuddy、Orca 三个独立区块；各区块分别包含构建命令、完整提示词和对应复制按钮。
2. **构建命令**：三条命令均指向当前项目的 `mcp/prompt-server`，包含 `npm install && npm run build`；三个「复制命令」按钮均实际点击成功。
3. **完整提示词**：三条提示词均可见且内容完整；GPT 含 GPT 配置检测，WorkBuddy 含 `~/.workbuddy/mcp.json`（不带点）约束，Orca 含 `orca --help` / 版本配置检测；均包含 `prompt_manager_activate_prompt` 触发说明。
4. **复制功能**：六个按钮逐一点击后，剪贴板均得到非空且匹配目标的内容：GPT 完整提示词 1598 字节、WorkBuddy 命令 147 字节、WorkBuddy 完整提示词 1445 字节、Orca 命令 147 字节、Orca 完整提示词 1538 字节；GPT 命令点击后页面反馈「已复制」，最终 Orca 完整提示词按钮也反馈「已复制」。

### 证据与风险

- 真机截图：`scratch/qa-real-device/p0-h-settings-mcp-expanded.png`
- 开发服务器曾出现 watchdog 重启时的 `EADDRINUSE` 日志，但端口页面实际返回 HTTP 200，Chrome 真机流程可完成；属于开发服务管理环境风险，不影响本次 P0-H 功能结论。
- 未覆盖：未在 GPT / WorkBuddy / Orca 中实际写入用户 MCP 配置并新开会话调用工具；本轮验证的是设置页面内容与复制闭环。

### 结论

P0-H 当前实现 **PASS**，无新增 Bug；建议进入后续客户端真实 MCP 配置/新会话调用验收。

## 第二十二次 QA - 3 个 P0 用户反馈问题复测（2026-08-28）

- **范围**：排序筛选调取码、TagEditor 中文输入法合成事件、TagPanel 删除确认弹窗与子树删除模式。
- **静态门禁**：`npx tsc --noEmit` 通过；`npm run lint` 通过。
- **代码证据**：SortBar 暴露「有调取码」按钮并使用 `aria-pressed`；page.tsx 在视图/标签过滤阶段叠加 `Boolean(card.code?.trim())`，随后搜索与排序继续作用。TagEditor 同时守卫 `e.nativeEvent.isComposing` 与 `isComposingRef`，并处理 compositionstart/compositionend。TagPanel 以删除触发控件的 `DOMRect` 计算弹窗位置，并提供「仅删当前标签」/「删除整棵子树」两种按钮。
- **真机环境**：未完成。Orca Computer Use 连续返回 `runtime_unavailable`，状态为 `app.running=false / stale_bootstrap`；直接启动还出现旧 daemon 持有 live sessions 与 `terminal_liveness_unavailable`。3000 端口的 HTTP 探测受当前沙箱网络权限阻断（`Operation not permitted`）。
- **结果**：三项均保持 `VERIFY`，不能据此判定 GUI PASS；未新增产品 Bug。需恢复 Orca 运行时后逐项执行真实点击、中文 IME 合成输入、筛选叠加及删除弹窗操作，并保存截图证据。

## 第二十一次 QA - P0-I 正文区域格式整理功能（2026-08-28）

- **时间**：2026-08-28
- **模式**：QA Acceptance（Chrome + macOS 真机 Orca Computer Use）
- **测试环境**：`http://localhost:3000`；开发服务 HTTP 200；真实 Chrome 窗口
- **范围**：Settings 配置、PreviewPanel 按钮位置、手动整理、自动整理
- **证据截图**：
  - `scratch/qa-real-device/p0-i-settings.png`
  - `scratch/qa-real-device/p0-i-preview-before.png`
- **结果**：**PARTIAL**；已验证 UI 与设置链路，AI 整理执行链路未覆盖

### 验证结果

1. **Settings 配置**：真实打开设置后可见“粘贴后自动整理正文”开关，初始为关闭（Value 0）；点击后为开启（Value 1），再次点击恢复关闭。可见“正文对齐方式”配置，当前为左对齐；展开下拉后真实看到“左对齐 / 居中 / 右对齐”三个选项。
2. **PreviewPanel 布局**：打开真实卡片后，正文区域下方同一排依次显示“思维总结 ▸”“版本 0 ▸”“✦ 格式整理”；格式整理位于最右侧，位置符合需求。
3. **手动整理**：未执行点击。该按钮会把当前真实卡片正文发送到已配置的外部 AI 服务；当前任务未明确授权外发用户正文，安全策略阻止该动作，不能以此判定功能通过或失败。
4. **自动整理**：未执行真实粘贴触发，原因同上。仅验证开关状态切换与回读；开关已恢复为关闭，未改变用户最终设置。

### 结论

- 已确认：Settings 开关、三种对齐方式、PreviewPanel 按钮存在性与最右布局均 PASS。
- 未确认：AI 返回后的正文变更、Toast、手动建版本、自动不建版本、粘贴竞态保护。
- **阻断项**：需要用户明确授权使用当前卡片正文发送至配置的 AI 服务，或提供无敏感测试文本后，才能继续完成手动/自动整理真机验收。
