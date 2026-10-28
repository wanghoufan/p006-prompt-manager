# 提示词管理工具（Prompt Manager）

[English](./README.en.md) · [在线试用](https://wanghoufan.github.io/p006-prompt-manager/)

> 把散落在聊天记录、备忘录里的提示词收进一个能搜的卡片库，复制过几次、哪张最好用一目了然。在支持 MCP 的 AI 助手里说一句「调取 <调取码>」，它就按这张卡直接开工。

![提示词管理器首页：左侧标签树、中间卡片列表、右侧预览面板](docs/screenshots/home.jpg)

![示例卡片详情：右侧显示可用的提示词正文](docs/screenshots/detail.jpg)

> 两张截图都来自在线试用版的内置「示例知识库」（12 张只读示例卡），不含真实使用数据。

## 这是什么

一个跑在自己电脑上的提示词库。粘贴一段提示词正文，它会生成标题和标签，存成一张可搜索的卡片；之后可以按标签筛选、按复制次数或评分排序，查看与回滚正文版本，导出备份。

它也能接进 AI 工作流：给常用卡片设一个短「调取码」，在支持 MCP 的客户端里说「调取 weekly-report」，助手就会把这张卡的正文作为系统提示词使用。适合个人，也适合共用一台局域网主机的几个人的小团队；本地模式不需要注册账号。

## 核心能力

- **粘贴即建卡**：自动生成标题与标签（可关、可改），重复正文会先提醒。
- **找得到**：搜索标题、正文、标签、备注和调取码，`@code` 直达；标签树可展开、筛选。
- **越用越顺手**：手动复制与 MCP 调取共用次数；可打 1–5 星；按更新时间、复制次数或评分排序。
- **改坏能回滚**：正文保存自动存版本（最多 10 版），支持版本对比与回滚；标题、标签、备注、星级失焦即存。
- **数据在自己手里**：主存储是本机 SQLite；支持 Markdown / JSON 导入导出、回收站、10 秒撤销，以及 Docker 自托管。
- **接进 AI 工作流**：内置 MCP server，令牌按设备生成、可随时撤销；兼容 WorkBuddy、Codex、Claude Code、Cursor 等支持 MCP 的客户端。

## 在线试用

打开 **[wanghoufan.github.io/p006-prompt-manager](https://wanghoufan.github.io/p006-prompt-manager/)** 就能看界面和交互。

试用版把数据存在当前浏览器的 localStorage：AI 自动整理、云同步和 MCP 都未启用，换设备或清浏览器数据不会带走卡片。可用顶栏「导出」备份。想长期使用，按下面的方式在本机或 Docker 里跑完整版。

## 本地运行（快速开始）

需要 Node.js 24+ 和 npm；AI Key 可选，不配也能建卡和搜索。

```bash
git clone https://github.com/wanghoufan/p006-prompt-manager.git
cd p006-prompt-manager
npm install
npm run dev
```

打开 <http://localhost:3100>。首次启动会在 `data/prompt-manager.db` 自动建库（SQLite，WAL 模式）。

想用 AI 自动起标题、打标签：在「设置 → AI 服务」里选服务商并填 API Key；也可以写进 `.env.local`（参考 `.env.local.example`），由服务端读取。支持 DeepSeek 官方、OpenRouter、OpenCode（Zen / Go 两个端点）。

常用命令：

```bash
npm run build   # 生产构建（standalone）
npm run start   # 本地预览生产构建，默认 3100（会打印 standalone 提示，可忽略）
npm run lint
```

备份与恢复：

```bash
bash scripts/backup-sqlite.sh backup
bash scripts/backup-sqlite.sh list
bash scripts/backup-sqlite.sh restore <备份文件>
```

## Docker 自托管

```bash
cp docker/env.template .env.local
# 编辑 .env.local：至少填 PROMPT_MANAGER_DATA_DIR（宿主机绝对路径）
mkdir -p /你的/数据目录
docker compose --env-file .env.local up -d --build
```

访问 `http://<主机地址>:3100`。SQLite 文件和备份都放在 `PROMPT_MANAGER_DATA_DIR` 指向的目录，容器重建不会丢数据。默认只适合可信局域网：本地模式没有账号体系，不要把 3100 端口直接映射到公网。

## 让 AI 助手调取提示词（MCP）

1. 在「设置 → MCP 本机访问」为本机生成令牌（只显示一次）。
2. 在项目根目录运行：

   ```bash
   node mcp/prompt-server/setup.mjs
   ```

   脚本会安装子包依赖、构建 MCP server、探测本机客户端并写入配置，最后做一次协议验证。可用 `--check` 只体检，`--client=<id>` 指定客户端。手工配置与其他参数见 [mcp/prompt-server/README.md](mcp/prompt-server/README.md)。
3. 新开一个客户端会话，说「**调取 <调取码>**」。命中后，卡片正文会作为该轮的系统提示词；这次调取也会让卡片复制次数 +1。

MCP 走本机 HTTP API，要求提示词管理器正在运行；每台电脑一枚独立令牌，丢失或不再使用时可在设置里撤销。

## 数据与边界

- **本地优先**：主存储是单机 SQLite；局域网多设备通过同一服务端实时同步。本地模式不做用户隔离，能打开页面的人就能改数据。
- **云端是可选项**：配置 Supabase 公开 URL 与 publishable key 后才启用云端同步和登录（回退路径）；不配置就是纯本地模式。
- **AI 是外部服务**：启用 AI 功能时，提示词正文会发送到你选择的厂商；Key 保存在本机设置或 `.env.local`，不会提交到仓库。
- **静态试用版**：纯浏览器运行，数据与 API Key 只存当前浏览器 localStorage；AI 由浏览器直连用户自备的 Key，支持建卡、搜索、生成标题标签与 AI 整理；MCP 与云同步需要本地服务端，试用版未启用。
- **许可**：源码可见，但**不是开源许可**——采用 [PolyForm Noncommercial 1.0.0](LICENSE)（非商业许可）。允许个人学习、自用、修改与非商业分发；**禁止任何商业用途**（包括在公司内部使用、集成进付费产品、对外提供有偿服务）。商业使用需单独获得作者书面授权。

## 项目结构

```text
src/app/                页面与 Route Handler（AI 代理、同步、MCP 令牌）
src/components/         卡片、详情、标签、设置等界面
src/lib/                卡片 / 标签 / 存储 / AI 适配器
db/migrations/          SQLite 结构迁移
mcp/prompt-server/      MCP server 与一键配置脚本
Dockerfile / compose.yaml
```

## 更多

- MCP 接入说明：[mcp/prompt-server/README.md](mcp/prompt-server/README.md)
- 产品需求：[docs/pm/提示词管理工具-需求文档.md](docs/pm/提示词管理工具-需求文档.md)
- 质量记录：[docs/qa/BUGS.md](docs/qa/BUGS.md)
