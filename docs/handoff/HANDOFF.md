# HANDOFF｜交接（暂停/恢复用，先读我）

> **2026-10-11 主题＋交互优化阶段交接。本文件是现役唯一入口，无编号节。**
> 旧交接全文见 `HANDOFF.md.旧版-2026-09-13`（1900+ 行）。阶段状态：**DEVELOP（开发已暂停，待用户指令恢复）**。
> ✅ **2026-10-11 晚：三主题＋B1 批次已 commit+push+部署上线（`b6087f9`）；空仓库 theme 重置问题已复现并修复上线（`d3f4e92`，隔离实例 5/5 PASS）。用户数据零污染。**
> ✅ **2026-10-11 深夜：用户真机反馈「印谱与亮色一模一样」→ 删除 cinnabar 主题（`41cee11`，6 主题制收敛为 5：system/dark/light/phosphor/blueprint），已部署（镜像 `be7a6e8a1177`）；旧标签页幽灵已随用户关闭旧页面消失，主题切换持久化实测恢复。**
> ✅ **2026-10-12：主题文案微调——胶囊「亮色」置首、「暗色」改名「墨色」（`decb21e`，仅 label/顺序，theme 值 `dark` 不变），已部署（镜像 `68eb6e6af4b1`），真机 5/5 PASS（顺序/改名/墨色切换与刷新持久化/亮色恢复/设置下拉同步）。**

---
> ✅ **2026-10-31：MCP 离线接入包已开发完成 → 已 push `master`（`4ab3eab` feat + `c2248e6` docs）→ GitHub Pages 构建成功（run 41197053771）→ 线上真实浏览器实测 11/11 PASS。** 见下方「〇」。静态试用版（分享页）的 MCP 从「被隐藏」变成「可用」。**本地 Docker（3100）尚未部署**（见 0.5）。

## 〇、2026-10-31｜MCP 离线接入包（本轮：已完成，未提交未部署）

### 0.1 为什么做

用户三条诉求（毕业汇报前）：
1. 分享页（GitHub Pages 试用版）能用 MCP；
2. 把 MCP 配置提示词发到对方自己的电脑，让对方的智能体配好；
3. 然后直接用调取码调取卡片。

根因两条：
- 静态站没有服务端，而既有 MCP 依赖 `POST /api/mcp/activate` + `mcp_access_tokens` 令牌 → `95b1d49` 起 MCP 入口在试用版**整体隐藏**；
- `SettingsModal.tsx` 的 `MCP_PROJECT_ROOT` **写死开发机绝对路径**（`.../ing丨0813提示词管理器 mac gpt桌面 v1.0`），在部署副本与任何他人克隆里都不存在 → 连本地版那条「复制给 AI」在别人电脑上也必失败。

### 0.2 做了什么

方案：**离线单文件 MCP server**。把「有调取码的卡片」快照内嵌进一个零依赖 `.mjs`，手写 JSON-RPC over stdio，不依赖服务端/网络/npm。

| 文件 | 改动 |
|---|---|
| `src/lib/mcp/offline.ts`（新增） | 快照抽取、调取码命中、激活文本、单文件 server 生成、给 AI 的接入提示词、客户端配置片段（纯逻辑，无 React/DOM） |
| `src/components/McpPanel.tsx`（新增） | `McpPanel`（调取台 + 下载接入包 + 复制提示词 + 手工配置）+ `McpDialog`（独立弹窗 z-50） |
| `src/components/SettingsModal.tsx` | 静态版不再隐藏 MCP；新增 cards 入参；MCP 区块改为「打开 MCP 接入台」；联网版命令改相对仓库根；横幅文案改为「MCP 可用」 |
| `src/app/page.tsx` | 试用版顶部横幅加「MCP 接入台」直达按钮；向设置弹窗传 `cards`；渲染独立弹窗 |
| `tsconfig.json` | `exclude` 增加 `scratch`（临时验证脚本不应进构建类型检查） |

**未改动**：`/api/mcp/activate`、`mcp_access_tokens`、`mcp/prompt-server`、同步、存储、AI 代理 —— 一行未动。

### 0.3 验证证据（全部亲自跑过）

| 用例 | 结果 |
|---|---|
| `tsc --noEmit` / `eslint src` | 0 error |
| 生成器边界断言 | 6/6 PASS |
| **官方 MCP SDK 客户端握手** | **9/9 PASS**（含大小写不敏感、结构化返回、未知码 isError） |
| 浏览器真实下载的包再握手 | 9/9 PASS |
| 静态试用版端到端（Playwright，真实 Pages 子路径形态） | **23/23 PASS**，控制台 0 错误 |
| 本地完整版 UI 回归（隔离库） | **11/11 PASS**，控制台 0 错误 |

详细落盘：`docs/review/CODE_REVIEW.md` §八（自审）、`docs/qa/BUGS.md`「MCP 离线接入包实测」。

### 0.4 自审发现并修复的 3 个问题

1. `__PM_GENERATED_AT__` 在模板里出现两次，`replace` 只改第一处 → 改 `replaceAll`（实跑发现）。
2. 数据注入顺序：先注入数据会让「正文里恰好含占位符字面量」的用户卡片被误改 → 数据改为**最后**注入（加边界断言）。
3. stdin 缓冲无上限 → 加 8MB 丢弃保护。

### 0.5 未做 / 需用户决定

- ✅ **已 push 并上线分享页**（2026-10-31，用户口令「现在推送」）：`e7c083a..c2248e6`，
  Actions run `41197053771` = completed/success。
- ⏳ **本地 Docker（3100）尚未部署**：需在部署副本 `~/Developer/coding/docker/prompt-manager/` 跑
  `bash scripts/deploy.sh`（记得先 `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"`）。
  未获用户明确部署指令，本轮未做。
- 已知边界（非本轮引入，未修）：卡片正文若含 `</activated-instructions>` 字面量会破坏包装结构，与既有 MCP server 行为一致。
- 账本 `check-ledger` 的**存量失败**：`DISPATCH-LOG` 有 6 处 `runtime` 用了枚举外写法（`本窗口subagent` / `本窗口直驱`），
  另有 2026-09-30 `TASK-P1-sync-loop` 同 task 两账 result 口径不一致。按「禁改写历史实绩」本轮**未动这些历史行**。
  连带后果：`TASK-MODEL-LOG.jsonl` 本轮那行**已落盘但未随本次提交入库**（pre-commit 的 check-ledger 会因上述存量失败 exit≠0）。
  待治理批次统一处理：把历史 `runtime` 规范到枚举值、为 09-30 那条按脚本指引另起一行更正，之后账本即可正常入库。
- **pre-commit 钩子修了一个真缺陷（2026-10-31）**：`scripts/pre-commit-guard.sh` 规则②原先把「母版只允许 `_example` 空壳」
  无条件套到所有仓，导致**任何项目仓都无法提交自己的账本真实行**（同脚本规则③早已用 `/4.Templates（PC）` 区分）。
  已改为同样分仓判定，并重装到 `.git/hooks/pre-commit`（旧版备份 `pre-commit.bak-2026-10-31`）。
  **该脚本本身仍是未跟踪文件**（属铺包批次），本次未一并入库，避免把他人未完成产物带走。

### 0.6 线上验证（push 之后实测，非仅看构建绿灯）

| 检查 | 结果 |
|---|---|
| 线上首页（带 `?v=` 绕缓存） | 200，20,337 bytes |
| 首页 HTML 含「MCP 接入台」「网页试用版…」文案 | 命中 |
| `_next/` 静态资源 | 3/3 返回 200（注意：用 origin+路径拼接，**不能**再叠一次子路径，否则假 404） |
| 线上真实浏览器交互 | **11/11 PASS**（横幅入口→接入台→调取码命中→下载→复制提示词→控制台 0 错误） |
| 线上下载的包 → 官方 SDK 客户端握手 | **9/9 PASS** |

### 0.7 真实智能体验证（2026-10-31 补，用户要求「要在不同智能体去尝试调取」）

**先说结论：调取码是在 AI 客户端里调取的，网页里的调取台只是预览，不算真调取。** 上一轮只用官方 SDK 模拟客户端，
本轮把离线包装进真实客户端、让真实模型调取。

**揪出「为什么一直不能用」**：本机三处配置全部指向同一个不存在的路径
（`.../ing丨0813提示词管理器 mac gpt桌面 v1.0/mcp/prompt-server/dist/index.js`）：

| 客户端 | 原状 |
|---|---|
| WorkBuddy `~/.workbuddy/mcp.json` | 路径失效 + `disabled: true` |
| opencode `~/.config/opencode/opencode.jsonc` | 路径失效 + `enabled: true` |
| opencode 仓库根 `opencode.jsonc`（**已跟踪入库**） | 路径失效，且项目配置覆盖全局 |
| codex `~/.codex/config.toml` | 原本无此条目 |

另查真实库：`mcp_access_tokens` 有效令牌 **0 个** —— 联网版从未配成功。

**修复后真调结果**：

| 智能体 | 证据 | 结果 |
|---|---|---|
| opencode 1.19.4 | `"type":"tool_use"` + `"tool":"prompt-manager_prompt_manager_activate_prompt"` | PASS |
| codex 0.164.0 | `{"type":"mcp_tool_call","server":"prompt-manager","tool":"prompt_manager_activate_prompt","arguments":{"code":"vrfa"},"status":"completed"}` | PASS |
| WorkBuddy | 配置已修、已解除禁用，**未做 GUI 会话实测** | 未验证（需用户重开会话） |

**副产物**：codex 首次收到「调取 vrfa」时去 `rg` 搜文件而不是调工具，指名后立刻正常 → 已把
「说调取时请直接调 MCP 工具，不要搜文件」写进接入提示词。

仓库根 `opencode.jsonc` 已清空机器专属条目：入库文件写死本机路径会让任何克隆者拿到失效配置。

### 0.8 接入台信息架构重做（2026-10-31 晚，用户反馈后）

用户判定原面板是「安装手册」：步骤过多，且把「下载接入包」摆在明面上。已重做为两层：

- **外层只有两步**：① 复制这段发给 AI（点一次 = 同时下载接入包 + 复制提示词，用户不用关心下载/安装细节）；
  ② 对 AI 说「调取 调取码」（直接列出现有调取码，点一下复制该命令）。
- **折叠区**：接入包体积与逐条安装动作、浏览器内试调取、手动配置（JSON/TOML + 自检）、提示词全文。
- 空库去向：卡片详情设调取码，或用顶栏「示例」载入自带调取码的示例卡。

验证：静态试用版 E2E 24/24 PASS（新增 5 条结构断言），控制台 0 错误。

### 0.9 复制即装（2026-10-31 第三次修正，用户裁定）

用户裁定：**只点复制、粘给智能体就完成安装，用户不该下载/上传/再做别的。** 前两版（分步骤 + 下载文件）均被判错。

现行实现：点一次「复制安装指令」= 一段自包含文本（给智能体的步骤 + `===BEGIN===`/`===END===`
包着完整脚本源码与卡片数据）。智能体照做：建目录 → 写文件 → 探测 node → `--selftest` → 写客户端配置 → 真实调取。

证据：点复制**无下载事件**；剪贴板 10,274 字；从该文本还原脚本后 `--selftest` PASS、
官方 SDK 握手 9/9 PASS。代价是文本较长（示例库约 10 KB、真实库约 34 KB），面板显示字数、折叠区可看全文。

### 0.10 明天汇报时的演示路径

1. 打开分享页 → 顶部横幅点「MCP 接入台」→ 输入示例调取码（如 `code-review`）→ 立即看到命中卡片与「AI 侧收到的原文」；
2. 点「下载 prompt-manager-mcp.mjs」→ 点「复制接入提示词」→ 贴给任意 AI → 自动装好并自检；
3. 若时间允许，现场让 AI 说「调取 code-review」验证真调取。

---

## 一、当前工作进展

### 1.1 生产环境状态（已上线，可用）

| 项 | 值 |
|---|---|
| 访问地址 | `http://192.168.31.60:3100`（Mac Mini Docker 自托管，局域网；**2026-10-11 实测本机 LAN IP 已变为 `192.168.31.42`，`.60` 直连超时——用户手机/其他设备如打不开请核对本机当前 IP，文档地址待用户确认后更新**） |
| 容器 | `prompt-manager-prompt-manager-1`，`0.0.0.0:3100` |
| 生产镜像 | `68eb6e6af4b1` |
| 远端仓库 | `https://github.com/wanghoufan/p006-prompt-manager.git`，分支 **`master`**（**远程不存在 `main`**，本地 `wanghoufan/main` 是 `~/Developer/Playground/` 下另一个 worktree 的分支，与本仓无关） |
| 主分支 HEAD | `decb21e`，与 `origin/master` 同步 |
| 用户数据 | 135 张卡片 / 50 个标签 / 203 条关联 / `version≈57541`，**全程零污染**（内容级校验，见 §三·4） |

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

### 1.4 本轮（2026-09-30，commit `b069dba`，生产镜像 `398a5fb503de`）已修复并上线

改 5 个文件：`src/lib/serverStore.ts`、`src/lib/storage.ts`、`src/app/page.tsx`、`src/components/CardDetail.tsx`、`src/components/PreviewPanel.tsx`。

| 编号 | 内容 | 实测数字 |
|---|---|---|
| P1 | **推送死循环**：`serverStore` 守卫比较前对库内 settings 也过 `sanitizeSettings`，两侧同形状比较 | 点 1 次星：`POST /api/sync` **3024 → 1 次**、`version` **+2204 → +1**；生产只读验证 `version` 静置 11 秒零增长 |
| P1 | **详情页双挂载标题静默丢失**：`CardDetail` + `PreviewPanel` 加 dirty 标记，仅本组件确有未落库编辑时才在 `[card]` effect 里 flush | 双挂载改标题：**2~70 次 POST + DB 留旧值 → 1 次 POST/+1 + DB 存新值** |
| P0（预防性） | **冲突回灌加版本方向门槛**：仅 `version` 回退（wipe）才自动回灌；递增或持平（对端合法删光）禁止自动推回，改走冲突刷新 + 明确提示 | 两条路径均不复活对端已删数据 |
| — | `subscribeSync` 改为推送在途先等落地再比较版本 | — |

**已上线并 `curl` 验 HTTP 200；生产 `version=57391` 静置零增长，124 卡/48 标签/194 关联零污染。**

### 1.5 本轮（2026-10-11）：三套新主题 ＋ B1 交互修复 —— 已验证，**未提交未部署**

用户拍板口径：**A=三种新主题全做**、顶栏胶囊分段速切；**B1=全站系统性交互打磨**；**C1=完成后部署上线**（等口令「现在推送」）。

**主题（6 主题制：system / dark / light / cinnabar / phosphor / blueprint）**

| 改动 | 文件 |
|---|---|
| 追加 3 个 `html.theme-*` token 块（朱砂印谱·亮 / 夜航磷青·暗 / 工程蓝图·暗＋28px 网格纹理）＋ mark 规则 ＋ color-scheme | `src/app/globals.css` |
| theme 联合类型扩 6 值 | `src/lib/types.ts` |
| THEME_VALUES 校验 | `src/lib/storage.ts` |
| 两处 theme 白名单（L61/L375 附近） | `src/lib/serverStore.ts` |
| 防 FOUC 内联脚本支持主题 class ＋ `?theme=` URL 预览参数 | `src/app/layout.tsx` |
| 主题 effect 应用 class＋URL 覆盖；TopBar 接线 | `src/app/page.tsx`（L386-403、L2055-2056 附近） |
| 顶栏胶囊分段速切器（md 以上显示，active=bg-gold/15＋text-gold-bright） | `src/components/TopBar.tsx` |
| 主题下拉补 3 项 | `src/components/SettingsModal.tsx` |
| settings 表重建放宽 theme CHECK（dev 库已应用；**生产库部署时自动跑 migration**） | `db/migrations/0003_theme_values.sql`（新增） |

**B1 交互修复（本轮新做）**

| 改动 | 文件 |
|---|---|
| 切服务商**保留**用户自定义 Base URL（仅未自定义时跟随回填默认）；文案说明 | `src/components/SettingsModal.tsx` |
| API Key 输入框加「显示/隐藏」切换（password↔text） | 同上 |
| 设置弹窗心智统一为**全即存**：思维模板改防抖 800ms 即存（校验失败不落库只红字提示），底部「取消/保存设置」→ 单「完成」＋「所有设置更改后立即自动保存」 | 同上 |
| 窄屏顶栏：btn/btn-gold/btn-ghost 加 `whitespace-nowrap`，header 加 `flex-wrap`，标题 `whitespace-nowrap`（修复 480px 下按钮被压成竖排） | `src/app/globals.css`、`src/components/TopBar.tsx` |

**验证（全部通过）**：`tsc --noEmit` 0 错；lint 0 错（7 个既有 warning）；`next build` 过；Playwright headless 16/16 PASS（窄屏 480/360/1280 无横向溢出、Tab 焦点框 2px solid、Key 可见性切换、非法模板红字、模板防抖即存 localStorage、「完成」关闭、自定义 Base URL 保留/回填）；主题链路此前已实测：点击→html class→localStorage→`POST /api/sync` 持久化全链 PASS，三套主题真实截图确认。

**已知未修（存量问题，非本轮引入）**：~~空仓库刷新页面会把服务端 theme 重置为 system~~ → **2026-10-11 晚已复现并修复上线（`d3f4e92`）**：根因是 `connect()` 的「服务端空+本机空」分支不 setSettings，state 停在挂载静态默认值，hydrated 后 save effect 把默认值反写服务端；修复为双侧皆空时同样以服务端快照为准。隔离实例 5/5 PASS（三新主题点击保持＋空库刷新持久化）。

**⚠️ 多客户端注意（2026-10-11 实测）**：**部署前就已打开的旧标签页/旧设备（旧版 JS）会把三个新主题归一化回 system 并推回服务端**（旧 `normalizeSettings` 白名单无 cinnabar/phosphor/blueprint；实测 legacy dark 存活、cinnabar 1 秒内被杀、light 稳定）。**用户需刷新/关闭所有旧标签页与旧设备页面后再用新主题**，否则新主题会被旧客户端打回 system。这是全量快照同步＋客户端版本偏差的固有表现，服务端无法区分「用户选 system」与「旧客户端归一化」，不做服务端防御。

---

## 二、下一步的任务

### 0｜✅ 已完成（2026-10-11 晚）：2026-10-11 这批改动已上线

1. ~~`git status` 确认改动清单~~ ✅（含清单外 5 个治理 docs，已分 feat/docs 两笔提交）
2. ~~commit → push `master`~~ ✅ `b6087f9`（feat `170646a` + docs `b6087f9`）
3. ~~部署~~ ✅ 镜像 `398a5fb503de → c685b905c5ca`，migration 0003 已自动应用到生产库（CHECK 6 值已验）
4. ~~真机实测~~ ✅ 胶囊切换/aria-checked/「完成」即存/480px 无溢出全 PASS；**过程中复现空仓库 theme 重置并修复上线 `d3f4e92`**（镜像 `78dbd01a4716`），隔离实例 5/5 PASS
5. ~~收尾清理~~ ✅ temp/主题预览 已删、dev server（3210）未在运行、3101 隔离实例已停、隔离库已删

**遗留一句**：生产实测发现**部署前打开的旧标签页/旧设备会把新主题打回 system**（详见 §一·1.5 末条），需用户刷新旧页面，非代码可修。

### P2｜遗留清单（本轮未清）

- **P2｜wipe 后恢复本机数据多发空推**：wipe 后恢复本机数据时多发 1~2 次内容相同的空推（实测 **3 次**，要求 **≤2**）。服务端 dedup 不 bump version，**不造成 version 通胀**。位置：`src/lib/storage.ts` 冲突回灌路径。
- **未测｜推送失败路径（T11）**：故障注入**未测完整**，失败后 cache 是否残留空快照**未判定**。（不得写 PASS）
- **产品验收矩阵**：20 条仍 **PASS 2 / DEGRADED 11 / 未测 9**。
- **已知既有**：React #418 水合 pageerror（回收站计数），本轮碰到 1 次，与本轮改动无关。

### P1｜功能改进（用户尚未拍板，承接原 §二·P1 四条）

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
| **Playwright 等待用 `domcontentloaded`，禁 `networkidle`** | 本项目有 SSE 长连接（`/api/sync/stream`），networkidle 永远等不到 → 卡死（2026-10-11 实测） |
| **headless Chrome CLI 截图本机不可靠**，用 `python3` + Playwright（已装 `~/Library/Python/3.9`） | CLI 截图进程卡死；python Playwright 稳定（2026-10-11 实测） |
| 本地 dev 验证端口用 **3210** | 3100 被生产容器占用、3000 被别的项目占用；`npx next dev -p 3210` |
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

1. 读本文件 → 读 `AGENTS.md`（ORCA 段 + §十一 踩坑）→ 读 `USER_MODEL_OVERRIDE.md`。
2. **先确认 §二·0 是否已做**：`git status` 若仍有 §一·1.5 的未提交改动，第一件事是等用户口令「现在推送」后提交并部署上线；若工作区干净且线上已是新版，跳过。
3. 之后问用户：做**遗留清单（P2 空推整备 / T11 故障注入补测 / 原 P1 四条功能改进）**、**用户新需求**、还是**AC 补证**？
4. 任何派工前先按 §三·2 搭好隔离环境、§三·1 备好部署 PATH。

## 治理规则更新通知 · 2026-10-17
- **发生了什么**：本项目的治理文件（`AGENTS.md`／角色卡／README／编排者提示词／`scripts/*`）于 2026-10-17 被母版编排者批量铺包更新到最新版。
- **为什么**：母版当天做了一轮体系修订（触发口令改名为「你是主开发者」、复核粒度改为「交付单元」、子代理模型与执行层/判定层分界、
  账本新增若干机器门等）。铺包时本项目的旧文件已按惯例备份为同目录的 `*.旧版-2026-10-17`，**未删除任何文件、账本内容零改动**。
- **对你意味着什么**：不需要你做任何操作；下次开工时你读到的 `AGENTS.md` 即为新规则。
  其中影响执行方式的三条：①口令是「你是主开发者」（旧口令「你是唯一开发者」仍可用）；
  ②复核链**不再对每个小任务跑**，改为对「交付单元」（阶段收口）跑一次；
  ③若你的客户端支持派子代理时传 model/强度，执行层子代理**一律用 `opencode-go/deepseek-v4.1-flash`**（真机取证走 `codex/gpt-6-luna`）。
- **需要你确认的**：若本次铺包覆盖了你项目里**自己改过的同名治理文件**，请对照同目录的 `*.旧版-2026-10-17` 备份，把你的专属条款合并回去。
- **回退方式**（如需）：把对应的 `*.旧版-2026-10-17` 改回原名即可。
