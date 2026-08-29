# Prompt Manager MCP Server

通过「调取码」加载提示词管理库中的卡片正文，并计入该卡片复制次数。MCP 工具结果本身不是 system message；客户端把返回内容交给模型后，模型再按其中的角色 / 任务指令继续。

## 一条命令接入

把这句话发给你的 AI（它会自动完成安装、配置和验证）：

```
请执行 node "<项目根>/mcp/prompt-server/setup.mjs" 完成提示词管理器接入，成功后用一句话告诉我怎么用。
```

也可以自己跑：

```bash
node mcp/prompt-server/setup.mjs
```

脚本会自动做四件事：装依赖 → 构建 → 探测本机的 AI 客户端并写配置 → 真调一次验证。

| 选项 | 作用 |
|---|---|
| `--dry-run` | 只预览会改什么，不写文件 |
| `--check` | 只体检（构建状态 + 配置状态 + 连通性），不写配置 |
| `--client=<id>` | 只接入指定客户端，逗号分隔。可选：`workbuddy`、`codex`、`opencode`、`cursor`、`claude`、`cline`、`windsurf`、`gemini` |
| `--remove` | 从各客户端配置中移除 |
| `--json` | 机器可读输出，便于 AI 解析 |

数据安全：脚本只读提示词库，不修改任何卡片、标签或调取码。验证阶段会把计数回调指向一个不可达端口，所以连「复制次数 +1」的副作用都不会发生。

写配置前会自动备份原文件（`<文件>.bak-<时间戳>`）。

## 工具

| 工具 | 参数 | 说明 |
|---|---|---|
| `prompt_manager_activate_prompt` | `code: string`（调取码，大小写不敏感） | 命中返回 `{ code, title, body, tags, thinkingSummary, updatedAt }`；`body` 是仅供模型执行的正文，未命中返回 isError |

**副作用**：每次命中调取，该卡片 `copyCount +1`（与手动复制共用总数），通过 Next.js 计数 API 写入。

## 数据源

读取提示词管理工具服务端落盘文件：`<项目根>/data/store.json`（由 `npm run dev` 实时写入）。

服务本身**只依赖这个文件的存在**，不需要 dev 服务处于运行状态。只有「复制次数 +1」需要 dev 服务在 `http://localhost:3100`，失败会静默跳过（可用环境变量 `PROMPT_MANAGER_API_URL` 覆盖地址）。

首次使用前需要先启动一次 `npm run dev` 并打开页面，让数据落盘。

## 手工构建与运行

```bash
cd mcp/prompt-server
npm install
npm run build        # 产出 dist/index.js
node dist/index.js   # stdio 模式，等待 MCP 客户端连接
```

## 客户端配置落点

脚本按客户端写入各自的位置；手工配置时参照下表。

| 客户端 | 配置位置 | 格式 |
|---|---|---|
| WorkBuddy | `~/.workbuddy/mcp.json` → `mcpServers` | JSON |
| Codex CLI | `~/.codex/config.toml` → `[mcp_servers.xxx]` | TOML |
| OpenCode | `~/.config/opencode/opencode.jsonc` → `mcp` | JSONC |
| Cursor | `~/.cursor/mcp.json` → `mcpServers` | JSON |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` → `mcpServers` | JSON |
| Cline（VS Code） | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` → `mcpServers` | JSON |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` → `mcpServers` | JSON |
| Gemini CLI | `~/.gemini/settings.json` → `mcpServers` | JSON |

> WorkBuddy 注意：配置文件是 `~/.workbuddy/mcp.json`（**不带点**）；带点的 `~/.workbuddy/.mcp.json` 是 connector-proxy 专用，不要混用。

接入后每个客户端需要做一次「收尾动作」（脚本会在结束时列出）：

- WorkBuddy：在「连接器」页面点一下「信任」，然后新开一个会话
- Codex / Gemini CLI：新开会话
- Cursor：Settings → MCP 确认开关打开，或重启
- Claude Desktop / Cline / Windsurf：完全退出后重开

## 怎么用

在提示词管理器里给卡片设一个调取码，然后对 AI 说「调取 <调取码>」，AI 就会加载那张卡片作为当前会话的角色 / 任务。
