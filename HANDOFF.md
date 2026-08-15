# 交接上下文（提示词管理工具 / 012）

> 供新会话继续工作。仅含：当前状态、关键决定、文件结构、约束、下一步。不含讨论过程。

## 当前状态
- 项目：提示词管理工具（Next.js + TypeScript 前端应用），处于**初稿**阶段。
- `012` 已按「多 Agent 协作模板」完成目录归位：建好 `docs/pm`、`docs/qa`、`docs/review`、`scratch/`，中文文档已迁入对应目录。
- `012` **尚未 git 初始化**（当前不是 git 仓库）。
- 协作约定已写入 `AGENTS.md`（保留 Next.js 块 + 追加协作约定段）；`.gitignore` 已追加忽略 `scratch/`、`*.notes.md`。
- 已建立两套可复用模板（见「模板」）。

## 关键决定
1. 清理工具（neat-freak）只在**项目整体完成 / 交付**时跑完整收尾；不在每次改动后清理。
2. 阶段性随时 `commit` / `push` 到 GitHub 备份源码与交付物；靠 `.gitignore` 隔离垃圾（`scratch/`、`node_modules/`、`.next/``、`、`.env*`、`*.notes.md`）。
3. 多 Agent 协作：交付物落固定目录（`docs/pm`、`docs/qa`、`docs/review`），临时资料放 `scratch/`；Agent 先读 `AGENTS.md` 索引再产出，不重复生成。
4. 新项目从模板起手、早期 `git init` 并提交约定基线，避免事后重组。

## 文件结构（012 根目录，关键项）
```
012 丨编程丨提示词管理工具/
├── AGENTS.md          # Next.js 块 + 多 Agent 协作约定（核心，约定段勿删）
├── CLAUDE.md          # @AGENTS.md 导入
├── .gitignore         # 已忽略 scratch/、*.notes.md（保留默认 Next.js 项）
├── docs/
│   ├── pm/            # 产品经理 Agent 交付物：需求文档.md、产品报告.md
│   ├── qa/            # QA Agent 交付物（暂空，占位）
│   └── review/        # 代码审查 Agent 交付物：代码审查报告.md
├── scratch/           # 临时资料，不进仓库
└── src/               # 源码（未改动）
```

## 模板（Playground 根目录，可复制复用）
- `多Agent项目模板 v1.0/` — 网页项目（Next.js），保留 Next.js 专属 `.gitignore`，未改动。
- `多Agent项目模板-通用/` — 任意项目；各语言 `.gitignore` 段已注释，用时取消行首 `# ` 启用；`AGENTS.md` 含语言中立的 `# 例：` 注释。

## 约束
- 不得删除 `AGENTS.md` 的「协作约定」段（`docs/` 落点表 + 4 条规则）。
- 临时脚本 / 实验副本只放 `scratch/`；不 `git add` 垃圾。
- 密钥、`.env*` 永不进仓库。
- 跨平台：文件名 UTF-8（中文可用），路径用 `/`；`AGENTS.md` 大写（Windows 可读）。
- `012` 当前非 git 仓库：首次推送前需 `git init` + 加 remote（由用户授权后执行）。

## 下一步
- 继续开发提示词管理工具功能；新功能 / 测试产物落入对应 `docs/` 目录，调试脚本丢 `scratch/`。
- 阶段性 push 备份（用户授权后由其他 Agent 执行）。
- 项目整体完成时：跑完整 neat-freak 收尾（对齐 docs + 规则 + 记忆，清理 `scratch/` 与残留）。
- 开新项目：复制 `多Agent项目模板-通用/`（或网页版），填 `AGENTS.md` 档案段，早期 `git init`。
