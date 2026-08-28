# Prompt Manager MCP Server

通过「调取码」加载提示词管理库中的卡片正文，并计入该卡片复制次数。MCP 工具结果本身不是 system message；客户端把返回内容交给模型后，模型再按其中的角色 / 任务指令继续。

## 用途

在 WorkBuddy / 其他支持 MCP 的 Agent 中，输入「调取/激活/加载/切换到 + 短码」（如 `调取 jbyj`），即可向模型提供对应卡片的私有角色 / 任务指令。成功结果要求模型不展示正文、不因激活而泛化追问，并立即执行正文中明确的初始化或任务。

## 工具

| 工具 | 参数 | 说明 |
|---|---|---|
| `prompt_manager_activate_prompt` | `code: string`（调取码，大小写不敏感） | 命中返回 `{ code, title, body, tags, thinkingSummary, updatedAt }`；`body` 是仅供模型执行的正文，未命中返回 isError |

**副作用**：每次命中调取，该卡片 `copyCount +1`（与手动复制共用总数），通过 Next.js 计数 API 写入。

## 数据源

读取提示词管理工具服务端落盘文件：`<项目根>/data/store.json`（由 `npm run dev` 实时写入）。
要求：dev 服务曾启动并保存过数据（首次打开页面会自动同步 localStorage 数据上去）。

## 构建与运行

```bash
cd mcp/prompt-server
npm install
npm run build        # 产出 dist/index.js
node dist/index.js   # stdio 模式，等待 MCP 客户端连接
```

## 接入 WorkBuddy

1. 编辑 `~/.workbuddy/mcp.json`（**不带点**；带点的 `.mcp.json` 是 connector-proxy 专用，勿混），在 `mcpServers` 中追加：

```json
{
  "mcpServers": {
    "prompt-manager": {
      "command": "/Users/zzymima0000/.workbuddy/binaries/node/versions/22.22.2/bin/node",
      "args": ["/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0/mcp/prompt-server/dist/index.js"],
      "description": "本地提示词管理库：通过调取码（code）加载角色或任务指令"
    }
  }
}
```

2. 在 WorkBuddy「连接器」→「配置 MCP」保存并**信任**该 server。
3. **新开会话**后生效；使用「调取 <调取码>」触发。

> 计数 API 地址可用环境变量 `PROMPT_MANAGER_API_URL` 覆盖（默认 `http://localhost:3000`）。
