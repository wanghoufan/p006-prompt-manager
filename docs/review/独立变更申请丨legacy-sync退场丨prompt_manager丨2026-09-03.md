# 独立变更申请 丨 legacy `/api/sync` 退场 丨 prompt_manager

> 提交方：提示词管理器项目接入智能体（Builder）
> 申请日期：2026-09-03
> 收件方：共享 Supabase 数据库管理员（审批人）
> 依据：收口审查裁定 §三.4（旧链路不同意长期维持，限期提交独立变更申请）；转送提示词（2026-09-03 17:15）事项四
> 状态：**草稿，待审批。未经批准不实施任何代码或数据变更。**

---

## 1. 背景与问题

legacy 局域网同步链路（`/api/sync` GET/POST + `/api/sync/stream` SSE + 容器内 `data/store.json` 整库快照）是 Supabase 云端模式上线前的旧同步机制。其 POST 为**无记录级条件的整库覆盖写**，已真实造成过一次数据覆盖事故（2026-09-02 13:32，见收口裁定 §三.3/三.4，事后补传恢复）。云端主链路收口后，该链路继续保留写能力与云端数据形成分叉风险，管理员已明确不同意长期维持现状，要求限期退场。

## 2. 影响面分析（谁还在调用）

### 2.1 代码链路（本仓库 `src/`）

| 入口 | 调用条件 | 说明 |
|---|---|---|
| `connect()` 未登录分支（`src/app/page.tsx`） | **仅当浏览器未登录** | `isServerAvailable()` → GET `/api/sync`；`loadFromServer()` → GET；`pushToServer()` → POST；`subscribeSync()` → SSE |
| `schedulePush`/`doPush`（`src/lib/storage.ts`） | 仅 `serverMode=true`（即未登录且 GET 探活成功） | 持久化 effect 的自动整库推送 |
| 冲突重试（`storage.ts` `doPush` conflict 分支） | 同上 | POST 版本冲突时重拉重推 |

### 2.2 真实调用方核查

| 调用方 | 是否仍调用 legacy | 依据 |
|---|---|---|
| Mini（唯一真实使用设备，已登录） | **否** | 登录后 `connect()` 走云端分支，legacy 分支不进入 |
| 未登录浏览器 | 是（潜在） | 任何未登录访问 `:3100` 即进入 legacy 模式；当前无已知未登录使用场景 |
| MCP `prompt-server` v0.2.0 | 否 | 直连 Supabase `activate_prompt` RPC，不经过 `/api/sync` |
| `/api/sync/increment-copy` | **零调用方** | 全仓库（`src/`、`mcp/`）无任何 fetch 调用，属死路由 |
| 脚本/外部系统 | 无 | 无已知 cron、脚本或第三方调用该端点 |

### 2.3 legacy 数据现状（退役时需归档）

- 容器内 `/app/data/store.json`（bind mount `DockerData/prompt-manager/legacy-store/`）：144,584 B，**54 cards / 24 tags / 0 versions**，最后写入 2026-09-02 22:54（BUG-11 复测当晚的测试写入）。
- 云端 Supabase 为权威数据源（54 cards，含 53 真实卡）。legacy store 与云端存在历史分叉，**退役时按原样归档，不做合并**。

## 3. 申请方案（推荐：方案 A 两阶段收缩）

### 方案 A（推荐）：先收写、缓退役

**阶段一（本次申请范围，纯应用侧改动，不触达数据库）：**

1. `POST /api/sync` 退役：服务端直接返回 `410 Gone`（JSON 错误体说明退场），整库覆盖写能力即刻消除。
2. `/api/sync/increment-copy` 死路由一并移除。
3. 客户端未登录分支适配：POST 收到 410 后置 `serverMode=false`，未登录用户降级为「本机 localStorage 模式」，一次性 toast 明示「共享同步已退役，更改仅保存在本机」；GET 读与 SSE 只读订阅暂保留（快照可看，不可写）。
4. `data/store.json` 冻结：归档至 `DockerBackups/prompt-manager/legacy-store-final/`（记录 SHA-256），原文件保留只读，不再有任何写路径。

**阶段二（缓办，后续单独确认后实施）：** GET `/api/sync` + SSE + `data/store.json` + 全部兼容代码整体删除；未登录 = 纯 localStorage。届时另行报备。

### 方案 B（备选）：一步直接退役

`/api/sync` 全部方法返回 410，SSE 关闭，未登录直接 localStorage-only。更彻底、代码更干净，但一次性移除面大，回滚粒度粗，且放弃「未登录可读共享快照」的过渡体验。

**推荐理由**：方案 A 与裁定「收缩为只读或直接退役（保留 SSE 只读链路可缓办）」完全对齐；写风险（唯一事故源）第一时间归零，读链路留缓冲期，回滚粒度细。

## 4. 数据库侧影响

**无。** `/api/sync` 写的是容器内 `store.json`，从不触达 Supabase；本变更不需要管理员起草任何 Migration、不需要收回任何数据库权限。如管理员认为需在数据库侧同步备案，请明示。

## 5. 回滚方案

- 代码：`git revert` 对应提交 → 同步 `Services/prompt-manager` → 容器重建（既有唯一发布流程），单提交回滚。
- 数据：`store.json` 归档件原样放回 bind mount 即恢复退役前状态（144,584 B，SHA-256 校验一致）。
- 云端：本变更全程不触达 Supabase，云端零回滚需求。

## 6. 验收标准（批准后实施时逐条核验）

1. **登录态零变化**：Mini 登录后 CRUD、Realtime、版本历史、MCP 调取与复制计数全部正常（走 Supabase，回归确认一遍即可）。
2. **写路径已死**：未登录状态下发起新增/编辑，网络层确认 `POST /api/sync` 返回 410；容器内 `store.json` 的 mtime 与 SHA-256 实施前后完全一致（覆盖能力消除的直接证据）。
3. **未登录可读**：GET 快照仍可读，页面有「仅本机保存」明确提示。
4. **归档完整**：`DockerBackups/prompt-manager/legacy-store-final/store.json` 存在且 SHA-256 与实施时容器内文件一致。
5. 死路由 `increment-copy` 返回 404/410。
6. 静态门禁：`tsc --noEmit` 0 错、ESLint 0 错、`npm run build -- --webpack` 通过。

## 7. 实施流程（批准后）

1. 应用侧改动（`src/app/api/sync/route.ts`、`src/lib/storage.ts`、`src/app/page.tsx` 未登录分支提示、删除 `increment-copy/route.ts`）。
2. 静态门禁 → 提交 → 用户授权 → 同步 Services + 容器重建 → 按第 6 节逐条验收 → 回报管理员（改动文件绝对路径、验证结果、遗留风险清单，经用户转送）。

## 8. 遗留风险与诚实标注

- 未登录用户的更改从「可同步到容器 store」变为「仅本机」——当前无已知未登录使用场景，影响为零；如有未知未登录使用者，其体验会变化（有明确提示）。
- legacy store 与云端的 54/54 分叉不合并；如管理员希望对账，可在归档时另行导出清单（需授权读取 store.json 内容）。
- 本申请为草稿，**未实施**；实施以管理员批准 + 用户授权为前提。
