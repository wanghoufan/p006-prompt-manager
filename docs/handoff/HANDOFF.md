# HANDOFF｜交接（暂停/恢复用，先读我）

> **2026-09-29 开发阶段收尾交接。本文件是现役唯一入口，无编号节。**
> 旧交接全文见 `HANDOFF.md.旧版-2026-09-13`（1900+ 行）。阶段状态：**DEVELOP（开发已暂停，待用户指令恢复）**。

---

## 一、当前工作进展

### 1.1 生产环境状态（已上线，可用）

| 项 | 值 |
|---|---|
| 访问地址 | `http://192.168.31.60:3100`（Mac Mini Docker 自托管，局域网） |
| 容器 | `prompt-manager-prompt-manager-1`，`0.0.0.0:3100` |
| 生产镜像 | `18bb1f033e35` |
| 远端仓库 | `https://github.com/wanghoufan/p006-prompt-manager.git`，分支 **`master`**（**远程不存在 `main`**，本地 `wanghoufan/main` 是 `~/Developer/Playground/` 下另一个 worktree 的分支，与本仓无关） |
| 主分支 HEAD | `16a604b`，与 `origin/master` 同步 |
| 用户数据 | 124 张卡片 / 48 个标签 / 194 条关联，**本日全程零污染**（内容级校验，见 §三·4） |

### 1.2 本阶段（2026-09-27 ~ 09-29）已完成并上线

| 提交 | 内容 | 触发来源 |
|---|---|---|
| `88f4d85` | 10 处 `window.confirm` → 自定义 `ConfirmDialog`（跟随触发点、Esc/点外部取消、z-60）；SortBar 新增「批量删除卡片」显式入口；TagPanel 批量入口改明显 | 用户要求 |
| `cb898f7` | 星级点击热区 14×14 → 26×22（视觉零变化） | **用户 P0 反馈**（点五颗星不管用） |
| `832f565` | 触屏端星级重叠带归属修复（事件委托按最近字形中心判定） | code-reviewer 报 P2 → 验证属实 |
| `6af818d` | 剩余 4 处 `window.prompt` → `PromptDialog`（批量打标签/移除标签/打星、标签新建/重命名/移动/合并） | QA 阻塞倒逼 + 用户早前已知技术债 |
| `cbf0c73` | SSR 水合致 localStorage 面板配置读不回来（面板宽度/展开状态/`pm:preview-width`） | QA 判 `AC-17` FAIL → 定位根因 |
| `16a604b` | **P0** 标签全量覆写自撞唯一索引（静默丢数据）+ 推送失败静默吞错 | code-reviewer 专审判为真 P1，编排者按数据丢失级定 P0 |

**全部已部署上线并 `curl` 验 HTTP 200。** 本日生产回归：确认弹窗 29/29、星级两轮各 17/17，headless 无头，不抢用户前台。

### 1.3 治理侧完成

- `docs/pm/PLAN.md` 末尾补录**产品验收追踪矩阵**（20 条 AC、关键 AC 集合、发布类型），`docs/model/GOVERNANCE-STATE.json` 的 `product_acceptance_ac_added: true` → **解除 AGENTS.md ORCA 段的红线待办**（否则今后每次收尾都会被判「计划缺项」）。
- 4 批 QA 实测落 `docs/qa/BUGS.md`「产品验收追踪矩阵」：**PASS 2（AC-17/18）／DEGRADED 11／未测 9／FAIL 2**，全部诚实记录、**无一条伪造 PASS**。
- 残留清理 + 文档事实对齐（远程地址、开发目录路径、Docker/数据库规范真相源、HANDOFF 引用等 6 处过期事实已修）。
- `AGENTS.md` §十一 新增 5 条踩坑（星级两层坑、零污染校验双错、AC 必须拆批、跨目录派工禁令）。

---

## 二、下一步的任务

### P0｜已知缺陷（**未修，用户已知情并同意暂缓**）

**【P1｜推送死循环】一次点击 = 3000+ 次 `POST /api/sync`**

- **现象**：编排者隔离实测，点 1 次星 → `POST /api/sync` **3024 次**、`meta.version` 从 1 冲到 2204。生产 `meta.version` 已达 **57391**（两天累积）。
- **对用户的影响**：App 变慢、服务负载高、请求浪费。**用户存的东西仍会正常保存，不丢数据**。属既有缺陷，非本日引入。
- **根因**（code-reviewer 静态确证 + builder 二次确证）：
  1. `GET /api/sync` 的 settings 经 `sanitizeSettings` **删掉** `aiApiKey` 键 → 浏览器 `normalizeSettings` 又**补回** `aiApiKey: ''`；
  2. `src/lib/serverStore.ts` 约 181–196 行「无变化不 bump version」守卫比较「库内表示（含键）」vs「推入表示（已剥键）」→ **永不相等 → 每次推送都 bump**；
  3. SSE 回声：`emitter.emit` 在 route 返回**之前**触发（`serverStore.ts:298` 附近）→ 客户端 `onRemote` → 四个 save effect → `schedulePush` → 再推 → **自持循环**。
- **建议修法（二选一，均为一行级）**：
  - A（推荐）：守卫比较前，**对库内 settings 也过一遍 `sanitizeSettings`**，两侧同形状比较；
  - B：`settingsForServer` 推出去时**保留 `aiApiKey: ''` 空串**而非删键。
  - **约束**：`aiApiKey` 的剥离是**安全要求必须保留**，两条方案都要证明 Key 仍不落库、不回传。
- **另建议**：加一道「内容与最近成功推送相同则抑制」的兜底，目标是**任何操作引发的 POST ≤ 2 次**；并保证**双页面 SSE 实时同步不劣化**。
- **验收口径**：点 1 次星 → 2 秒内 `POST /api/sync` ≤ 2 次、`version` 增长 ≤ 2、修前对照值是 3024 次 / +2204。

### P1｜功能改进（用户尚未拍板）

1. **批量删除后不自动退出多选**（`page.tsx` 用 `clearBulk` 而非 `exitBulkMode`，与其他三条退出口径不一致）—— 一行可改，问用户。
2. **P3 a11y**：`Stars.tsx:12` 的 `role="img"` 包裹可交互 button，辅助技术可能忽略内部控件 → 建议改 `role="group"`。
3. **P2-2**：`page.tsx` 导入/批量删除的**异步确认窗口期闭包快照可能陈旧**（`window.prompt` 改 async 引入的同源问题）—— 建议确认后改读 `cardsRef.current`。
4. **P1（`page.tsx` 水合告警）**：`useState(() => readTrash())` 同样是 SSR 水合问题。**不能照搬 `cbf0c73` 的方案** —— 回收站有「变更即写盘」effect 且 mount 就跑，改 initializer 为 `[]` 会导致**写盘 effect 先用空数组覆盖真实回收站数据**（先毁后读）。安全修法：`useState([])` + skip-first-write 守卫 + 挂载后同步。

### P2｜产品验收收尾（**性价比低，建议先问用户是否继续**）

20 条 AC 仍有 11 条 DEGRADED、9 条未测。按已发生成本估算，补完还需约 30–40 万 tokens，而 4 批 QA 实测的**真实产出是挖出 2 个真 bug**（`cbf0c73` 面板宽度失效、`16a604b` 静默丢数据）—— 说明真 bug 往往不是靠补 AC 找出来的，而是靠**用户实际使用 + 针对单点深测**。建议优先级：P0 死循环 > 用户新需求 > AC 补证。

---

## 三、注意事项及相关规矩

### 1. 🚨 部署与 Git 硬规矩

- **唯一部署方式**：改动 push 到 `master` 后，在**部署副本** `~/Developer/coding/docker/prompt-manager/` 执行 `bash scripts/deploy.sh`（脚本自带回滚点 → `git pull --ff-only` → build → up -d → HTTP 验证）。
- **部署必备环境变量**（本机 PATH 缺 Docker 凭据助手，**不加会构建失败**，且失败信息具有迷惑性 —— 报的是 `dockerfile:1` 语法镜像拉取失败）：
  ```bash
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
  ```
- **分支只有 `master`**（`origin/HEAD → origin/master`）。**推 `main` 会创建孤立分支、破坏部署链路。**
- commit / push **需用户明确指令**；已获授权时按上表执行。

### 2. 🚨 测试环境规矩（本日踩坑最多的地方）

| 规矩 | 原因 |
|---|---|
| **隔离实例必须放行 `POST /api/sync`**，只拦 Supabase 域名 | 隔离实例的持久化**正是靠 `/api/sync` 写隔离库**；拦掉它 → 「UI 改了但库没变、刷新即消失」→ 正常功能被误判为 bug。**本日编排者与 QA 各踩一次** |
| 零污染校验**必须用内容级**，禁止字节哈希 | 2026-09-28 迁 SQLite 后主存储是 `legacy-store/prompt-manager.db`；`store.json` 是 legacy 回退路径。活库字节本就会变（WAL checkpoint、用户自己建卡），字节哈希判定是**假阴性安全** |
| SQL 里 `__` 是单字符通配符、**不是下划线** | 要匹配字面下划线必须 `ESCAPE '\'`。误用会匹配到「**生成**QA…」等用户真实卡片，误报污染 |
| 断言前等 `meta.version` 连续 1.2s 不变 | 乐观更新 + 延迟落盘，立即查会读到旧值 → 假 FAIL。查列名是 `meta(key,value)`，**不是** `meta.version` |
| **起隔离实例不能用 `next start`** | 本项目 `output: standalone`。正确做法：`npx next build` → `cp -r .next/static .next/standalone/.next/` → `PORT=3101 SQLITE_DB_PATH=<scratch 内绝对路径> NEXT_PUBLIC_SUPABASE_*="" node .next/standalone/server.js` |
| 测试完停实例 | `lsof -ti :3101 \| xargs kill`。EADDRINUSE 会让服务静默起不来，报错是 `listen` 失败而非库问题 |
| **禁止抢用户前台** | 用户 2026-09-17 / 09-21 明文立规：全 headless；禁 `open -a`、禁 `osascript` 激活窗口。测试前记得 `lsof` 查残留端口 |

### 3. 派工通道规矩

- 读 `USER_MODEL_OVERRIDE.md` 取各角色精确模型 ID，**禁本窗口代做**。
- **派通道角色前先确认目录权限**：`opencode run` 读仓外目录会被 `external_directory` 自动拒、**整轮任务静默中断**（本日 neat-freak 因此白跑一次）。要么把仓外信息查好塞进任务书，要么先取得用户授权。
- 改完必须验证，**不许拿「工具调用成功」当「功能可用」** —— 编排者曾因此在 builder 声称 PASS 后又自己复现出 bug。
- **不许把没测的写成 PASS**。QA/planner 拒绝伪造并如实记 `未测`/`DEGRADED` 是**正确行为**，编排者不得推翻。

### 4. 数据安全

- 真实数据：124 卡 / 48 标签 / 194 关联，路径 `~/DockerData/prompt-manager/legacy-store/prompt-manager.db`。
- **未经用户明确授权，不得删改 DockerData / 部署副本 / 不 commit-push**。
- 生产库可**只读** SQL 查询（`sqlite3 <path> "SELECT ..."`），可作为「是否已中招」的判据。

### 5. 治理红线（AGENTS.md ORCA 段）

- **产品验收未落盘或关键 AC 未测、不得报完工**；首次发布未取得用户签收、不得报完工。
- 实绩 Plan 的 AC 补录**已完成**（`product_acceptance_ac_added: true`），该红线已解除。
- 派工跨目录禁令：**临时文件放仓内 `scratch/`，禁写 `/tmp`**。

### 6. 协作体验（本日的教训）

- 编排者**不要连续多轮自行验证而不汇报**。本日长时间无输出导致用户两次打断。
- 修 bug 优先于补文档/补 AC；**发现真 bug 时立即报告，不要闷头修**。
- 一次只做一件事，做完报一句。

---

## 四、恢复开发的第一步

1. 读本文件 → 读 `AGENTS.md`（ORCA 段 + §十一 踩坑 5 条）→ 读 `USER_MODEL_OVERRIDE.md`。
2. 问用户：本轮做**推送死循环（P1）**、**用户新需求**、还是**AC 补证**？（三者优先级见 §二）
3. 任何派工前先按 §三·2 搭好隔离环境、§三·1 备好部署 PATH。
