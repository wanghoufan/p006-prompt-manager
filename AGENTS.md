<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:collab-convention -->
## 多 Agent 协作约定（本项目）

本项目由多个 Agent 协作开发，固定落点如下；所有 Agent 动手前先读本文件，按归属目录读写，避免产物散落或重复生成。

| 路径 | 用途 | 是否进仓库 | 归属 Agent |
|---|---|---|---|
| `docs/pm/` | 需求文档、产品报告 | 是 | 产品经理 Agent |
| `docs/qa/` | 测试用例、测试报告 | 是 | QA Agent |
| `docs/review/` | 代码审查报告 | 是 | 代码审查 Agent |
| `scratch/` | 调试脚本、实验副本、一次性草稿 | 否（已被 .gitignore 忽略） | 任意，用完即弃 |
| `src/` | 源码 | 是 | 开发 Agent |

### 协作规则
1. 协作产物写入对应目录并在下方登记；仓库已有产物不重复生成。
2. 临时资料放 `scratch/`，默认不进 GitHub；清理只清此处，不碰 `docs/` 交付物。
3. 日常仅清空 `scratch/`；整体交付时再跑完整 neat-freak 收尾。
4. 进仓库 = `src/`、配置、`docs/` 交付物、真实测试套件；不进 = `scratch/`、密钥、本地笔记、`node_modules/`、构建产物（由 `.gitignore` 强制）。

## 项目定位
提示词管理工具 —— 管理、编辑与测试提示词的前端应用（Next.js + TypeScript）。

## 当前状态与下一步
- 当前状态：初稿
- 产物索引：需求见 `docs/pm/提示词管理工具-需求文档.md`；产品报告见 `docs/pm/产品报告.md`；代码审查见 `docs/review/代码审查报告.md`
<!-- END:collab-convention -->
