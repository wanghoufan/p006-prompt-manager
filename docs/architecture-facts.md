# 架构与构建事实（architecture facts）

> 本文件承接从 `docs/handoff/HANDOFF.md` 迁出的架构/构建事实。HANDOFF 只留指针。
> 最后核对：2026-10-31。

## 一、技术栈与存储

| 层 | 事实 |
|---|---|
| 前端 | Next.js 16（App Router）+ React 19 + TypeScript 5 + Tailwind v4 |
| 主存储 | 本地 SQLite（`node:sqlite` + WAL），访问集中在 `src/lib/serverStore.ts` + `src/lib/db/sqlite.ts`；结构变更走 `db/migrations/*.sql` |
| 生产库路径 | `~/DockerData/prompt-manager/legacy-store/prompt-manager.db`（`SQLITE_DB_PATH` 指向它） |
| 云端回退 | Supabase（`src/lib/supabase/promptRepository.ts`）；`NEXT_PUBLIC_SUPABASE_*` 留空即自动降级本地模式 |
| 同步 | 服务端 SSE `/api/sync/stream` 广播版本号；全量快照 + `baseVersion` 乐观并发 |
| AI | 通用 `AI_PROVIDER/AI_MODEL/AI_BASE_URL/AI_API_KEY`；服务商清单唯一来源 `src/lib/ai/types.ts` 的 `AI_PROVIDERS` |

## 二、两种运行形态

| | Docker / 本地完整版 | GitHub Pages 静态试用版（分享页） |
|---|---|---|
| 构建开关 | 默认（`output: standalone`） | `STATIC_EXPORT=1` → `output: export`，附 `BASE_PATH` |
| 数据 | 服务端 SQLite + 多端同步 | 仅浏览器 localStorage，无同步 |
| AI | `/api/ai/*` 代理 + 服务端 env 兜底 | 浏览器直连用户自备 Key（`src/lib/ai/browser.ts`） |
| MCP | 联网版（`/api/mcp/activate` + 设备令牌） | **离线包**（见 §四） |
| 判定 | `src/lib/trial.ts` 的 `IS_STATIC_TRIAL` | 同 |

## 三、静态试用版构建（踩过坑，照做）

```bash
rm -rf .next out                      # 必须先清：dev 残留的 .next/dev/types/validator.ts
                                      # 会指向随后被移走的 api 路由，导致类型检查失败
rm -rf src/app/api mcp                # CI 的 workflow 就删这两个（无 Node 运行时）
STATIC_EXPORT=1 BASE_PATH=/p006-prompt-manager \
NEXT_PUBLIC_BASE_PATH=/p006-prompt-manager \
NEXT_PUBLIC_STATIC_TRIAL=1 \
NEXT_PUBLIC_SITE_URL=https://wanghoufan.github.io/p006-prompt-manager \
npm run build
```

- 本地验证必须**模拟子路径**：把 `out/` 拷到 `pages-sim/p006-prompt-manager/` 再起静态服务，直接 serve `out/` 根路径测不出 `basePath` 问题。
- 校验线上资源用 `origin + /p006-prompt-manager/_next/...`；**再叠一次子路径会得到假 404**。
- 部署链路：push `master` → `.github/workflows/deploy-pages.yml` 自动构建部署（约 1～2 分钟）。

## 四、MCP 的两条路径

### 4.1 联网版（本地完整版 / Docker）

- 子包 `mcp/prompt-server`（`@modelcontextprotocol/sdk` + zod，stdio）。
- 依赖 `PROMPT_MANAGER_URL` + `PROMPT_MANAGER_ACCESS_TOKEN`（`mcp/prompt-server/.env.local`），令牌哈希存 `mcp_access_tokens`。
- 调取走 `POST /api/mcp/activate`，命中会把卡片 `copyCount +1`。
- 一键接入：在仓库根 `cd mcp/prompt-server && node setup.mjs`。
- **不得再写死机器绝对路径**（历史缺陷，见 `docs/risks.md`）。

### 4.2 离线包（静态试用版，也可给他人电脑）

- 生成器：`src/lib/mcp/offline.ts`（纯逻辑，无 React/DOM）。
  - `buildSnapshot`：只收「有调取码且正文非空」的卡片；同码去重取 `updatedAt` 最新。
  - `buildBundle`：把快照内嵌进零依赖 `.mjs`，**手写 JSON-RPC over stdio**（换行分隔），不依赖 SDK / npm / 网络。
  - `buildSetupPrompt`：产出「给智能体的安装指令 + 完整脚本原文」的自包含文本。
- UI：`src/components/McpPanel.tsx`（`McpPanel` + `McpDialog` z-50）。
  - 外层只有两步：① 复制安装指令（**只复制，不下载**）② 对 AI 说「调取码 xxx」。
  - 折叠区：接入包体积、试调取台、手动配置片段、提示词全文。
- 生成的 server 支持：`--list` / `--selftest [code]` / 无参数启动 stdio。
- 协议兼容性已用官方 SDK 客户端实测（见 `docs/qa/BUGS.md`「MCP 离线接入包实测」）。
- **定位脚本用的字面量必须全文唯一**：说明段里不能出现 `===BEGIN===` 或 `#!/usr/bin/env node`，
  否则按首个匹配解析会截错内容（已踩，见 `agent.md`）。

## 五、主题系统

- 5 个值：`system` / `light`（亮色·暖纸墨）/ `dark`（墨色·皮革账本）/ `phosphor`（夜航磷青）/ `blueprint`（工程蓝图）。
- 曾有的 `cinnabar` 已删除（与 light 肉眼无差）。
- 生效链：`html.theme-*` class + `localStorage` + `POST /api/sync`；`layout.tsx` 有防 FOUC 内联脚本。
- 校验白名单三处必须同源：`src/lib/types.ts`、`src/lib/storage.ts`、`src/lib/serverStore.ts`。

## 六、部署

| 项 | 值 |
|---|---|
| 唯一方式 | push `master` 后在部署副本 `~/Developer/coding/docker/prompt-manager/` 跑 `bash scripts/deploy.sh` |
| 必加 PATH | `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"`（否则凭据助手缺失、构建失败且报错具迷惑性） |
| 容器 / 端口 | `prompt-manager-prompt-manager-1`，`0.0.0.0:3100` |
| 分支 | 只有 `master`；**推 `main` 会造孤立分支并破坏部署链路** |
| 验收 | 部署脚本自带 HTTP 验证；另需真机打开确认新版 |

## 七、关键文件地图

| 路径 | 职责 |
|---|---|
| `src/app/page.tsx` | 主页面：视图、多选、导入导出、弹窗编排（2300+ 行） |
| `src/components/SettingsModal.tsx` | 设置（即存式）：主题、AI、MCP 接入入口、思维模板 |
| `src/components/McpPanel.tsx` | MCP 接入台（离线包 + 试调取 + 手动配置） |
| `src/lib/mcp/offline.ts` | 离线包生成器与安装提示词 |
| `src/lib/storage.ts` | localStorage + 服务端同步、导入导出、试用版播种 |
| `src/lib/trial.ts` | `IS_STATIC_TRIAL` 与内置试调取卡（调取码 `hi`） |
| `src/lib/serverStore.ts` | SQLite 服务端存储（全量快照 + 版本） |
| `mcp/prompt-server/` | 联网版 MCP 子包（stdio + setup 脚本） |
| `db/migrations/` | SQLite 结构变更 |
| `docs/sop/` | 基础设施规范（docker / supabase / sqlite / android / webqa …） |

## 八、测试与验证方式

- Playwright 用 **python3 + 系统 Chrome**（`channel="chrome"`）即可，无需下载 Chromium；全 headless，禁抢用户前台。
- 等待用 `domcontentloaded`，**禁 `networkidle`**（本项目有 SSE 长连接，永远等不到）。
- 隔离实例：`SQLITE_DB_PATH=<scratch 内绝对路径>` + `NEXT_PUBLIC_SUPABASE_*=`` + 端口 3101/3210（3100 归生产、3000 归别的项目）。
- 起隔离实例不能用 `next start`（本项目 `output: standalone`）：`npx next build` → `cp -r .next/static .next/standalone/.next/` → `node .next/standalone/server.js`。
- 零污染校验必须**内容级**（`COUNT(*)` / 最新 `updated_at` / 字面前缀残留），**禁用字节哈希**。
- 真实智能体验证：opencode（`--format json` 看 `tool_use`）、codex（`--json` 看 `mcp_tool_call`）。