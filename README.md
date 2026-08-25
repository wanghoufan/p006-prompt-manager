# 提示词管理工具（Prompt Manager）

本地网页端的提示词库：粘贴正文 → AI 自动生成标题与标签；复制即统计次数（手动复制 / MCP 调取共用）；打星评分、排序、版本回滚、思维方式总结；支持**局域网跨设备实时同步**，并可通过 **MCP** 让 WorkBuddy 等 Agent 用「调取码」一键激活卡片为系统提示词。

![首页截图](docs/screenshots/home.png)

## 功能概览

| 功能 | 说明 |
|---|---|
| AI 生成元数据 | 粘贴提示词正文，自动调用 DeepSeek 生成标题与标签（可手动编辑） |
| 示例知识库 | 内置 12 张示例卡片（自带调取码），覆盖全部功能形态，一键载入本地仓库 |
| 复制统计 | 卡片「复制」写入剪贴板并累计次数；**MCP 调取同样计入**；支持清零 |
| 调取码（code） | 用户自定义短码（英文/数字/短横线，≤12 字符，大小写不敏感，可选填），供 MCP 调取 |
| MCP 集成 | 子包 `mcp/prompt-server/`，工具 `prompt_manager_activate_prompt(code)`：取卡片并立即将其正文作为新的系统提示词注入会话 |
| 星级评分 | 点击 `1`~`5` 打星、`0` 清除 |
| 标签筛选 | 左侧标签面板单选筛选（再点取消），按数量排序 |
| 排序 | 按更新时间 / 复制次数 / 评分降序 |
| 版本回滚 | 编辑保存自动生成版本（最多 10 条），支持一键回滚 |
| 思维方式总结 | AI 分析提示词的框架与技巧，结果缓存在卡片上 |
| 跨设备实时同步 | 服务端共享存储 + SSE 推送：同一局域网多台电脑数据实时双向同步 |
| 导入/导出 | 全量 JSON/Markdown 格式备份与恢复（含调取码） |

## 快速开始

```bash
npm install
cp .env.local.example .env.local   # 填入 DEEPSEEK_API_KEY
npm run dev                        # 打开 http://localhost:3000
# 或带 watchdog 自愈地启动：
./dev-server.sh start              # 服务挂了 3 秒自动重启
```

### 局域网实时同步

- 服务监听所有网卡（`*:3000`）。同局域网内其他设备访问 `http://<本机IP>:3000` 即可共用同一份数据（数据存在运行 dev 服务的那台机器上，`data/store.json`）。
- 任意一端增删改，另一端几秒内自动刷新（SSE 推送）。
- `next.config.ts` 的 `allowedDevOrigins` 已放行 `.local` 主机名与常用 IP；IP 变化时需同步更新。
- 本机也可用 `.local` 地址：`http://<Mac主机名>.local:3000`。

### MCP 接入（WorkBuddy / 其他支持 MCP 的 Agent）

1. 构建并验证：`cd mcp/prompt-server && npm install && npm run build`
2. 把 `prompt-manager` 注册到 `~/.workbuddy/mcp.json`（**不带点**；注意 `.mcp.json` 带点的是 connector-proxy 专用，别写错）：
   ```json
   {
     "mcpServers": {
       "prompt-manager": {
         "command": "<node绝对路径>",
         "args": ["<项目根>/mcp/prompt-server/dist/index.js"],
         "description": "本地提示词管理库：通过调取码（code）返回卡片正文"
       }
     }
   }
   ```
3. 在 WorkBuddy「连接器」→「配置 MCP」里保存并**信任**该 server；之后**新开会话**生效。
4. 使用：输入「**调取 <调取码>**」（如 `调取 jbyj`），WorkBuddy 会调用 `prompt_manager_activate_prompt`，把卡片正文作为新的系统提示词直接执行，并给该卡片复制次数 +1。

> 详细接入说明见 `mcp/prompt-server/README.md`。

## 使用

- **示例知识库**：顶栏「示例」菜单切换浏览内置 12 张示例卡片（只读）；「载入示例到我的仓库」一键装入本地仓库；「清空我的仓库」一键清除。
- **新建**：在顶部输入框粘贴提示词正文，自动调用 AI 生成标题与标签（失败时可「重试」或「直接创建」）。
- **复制**：卡片上点「复制」写入剪贴板并累计次数；MCP 调取同样 +1。
- **调取码**：右侧面板 / 详情弹窗中填写（`@` 前缀输入框），冲突时实时红字提示；卡片上以 `@code` 徽标展示。
- **打星**：点击卡片选中后按 `1`~`5` 打星、`0` 清除；也可直接点星标。
- **排序/筛选**：默认按更新时间，或按复制次数/评分降序；左侧标签面板单选筛选。
- **详情**：点「编辑」或双击卡片进入。修改正文后按「保存」或 `Ctrl/⌘+Enter` 生成版本（最多 10 条，可回滚）；「重新生成标签/标题」；「思维方式总结」结果缓存在卡片上。
- **右侧面板**：思维总结 / 版本历史默认折叠，点 ▸ 展开；面板左缘可拖动调宽（320–720px，双击重置）。
- **设置**：自定义思维总结提示词模板（留空用默认）。
- **备份**：「导出」下载全量 Markdown；「导入」整体恢复（会覆盖当前数据）。

## 技术栈

- **Next.js 16**（App Router）+ **React 19** + **TypeScript 5**
- **Tailwind CSS v4** — 深色主题，响应式布局
- **DeepSeek API**（`deepseek-v4-flash`）— 服务端代理，自动生成标题 / 标签 / 思维方式总结
- **服务端共享存储** — `serverStore` 进程内单例 + `data/store.json` 落盘 + SSE 实时推送
- **MCP** — `@modelcontextprotocol/sdk`（stdio），独立子包 `mcp/prompt-server/`

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   ├── generate-meta/route.ts       # AI 生成标题+标签
│   │   │   └── summarize-thinking/route.ts  # AI 思维方式总结
│   │   └── sync/
│   │       ├── route.ts                     # 共享存储 GET 快照 / POST 覆盖
│   │       ├── stream/route.ts              # SSE 实时推送
│   │       └── increment-copy/route.ts      # MCP 调用计数（copyCount +1）
│   ├── layout.tsx
│   └── page.tsx                             # 主页面
├── components/
│   ├── CardDetail.tsx                       # 详情弹窗
│   ├── CardItem.tsx                         # 卡片组件（含 2 行正文预览、@code 徽标）
│   ├── Composer.tsx                         # 新建输入框
│   ├── DemoMenu.tsx                         # 示例菜单
│   ├── PreviewPanel.tsx                     # 右侧预览面板（可拖动宽度、折叠区、调取码输入）
│   ├── SettingsModal.tsx                    # 设置弹窗
│   ├── SortBar.tsx                          # 排序栏
│   ├── TagPanel.tsx                         # 标签面板
│   ├── TopBar.tsx                           # 顶栏
│   └── ...
└── lib/
    ├── ai.ts                                # DeepSeek API 封装
    ├── cards.ts                             # 卡片 CRUD + 版本管理 + 调取码规范化
    ├── demo.ts                              # 12 张示例数据
    ├── prompts.ts                           # AI 提示词模板
    ├── serverStore.ts                       # 服务端共享存储（单例 + 落盘 + 广播）
    ├── storage.ts                           # localStorage 兜底 + 服务端同步层
    ├── types.ts                             # 类型定义
    └── util.ts                              # 工具函数
mcp/prompt-server/
├── src/index.ts                             # MCP server（prompt_manager_activate_prompt）
├── package.json / tsconfig.json
└── README.md                                # MCP 接入说明
dev-server.sh                                # dev 服务 watchdog 管理脚本
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek 密钥（https://platform.deepseek.com），仅存于服务端 `.env.local` |
| `DEEPSEEK_MODEL` | 否 | 默认 `deepseek-v4-flash` |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com`（兼容 `/v1` 前缀） |
| `PROMPT_MANAGER_API_URL` | 否 | MCP server 计数 API 地址，默认 `http://localhost:3000` |

## 存储

- **同步源**：服务端 `data/store.json`（`serverStore` 落盘，含用户提示词，已被 `.gitignore` 忽略）。
- **离线兜底**：localStorage（键 `prompt-manager:cards` / `prompt-manager:settings`）。
- 首次打开时若服务端为空且本机 localStorage 有数据，会自动迁移上传。
- 请定期「导出」备份。

## 许可证

MIT
