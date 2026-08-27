<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md ｜ 提示词管理工具

> 多 Agent 协作总入口：公共规则 + 文档路由 + 角色索引。
> 各 Agent 动手前先读本文件，按归属目录读写，避免产物散落或重复生成。
> 协作方法论基线参考 `AI编程项目模板-手动协同-v2.1`。

## 一、项目档案

- 项目名称：提示词管理工具（Prompt Manager）
- 项目类型：Next.js 应用 + 服务端轻量共享存储 + MCP 子包
- 当前阶段：功能开发期（实时同步 / UI 优化 / 调取码 / MCP 集成已完成主体）
- 主要目标：管理、编辑与测试提示词
- 主要用户：使用 GPT 等大模型、需要集中管理 Prompt 的个人 / 团队

### 技术栈

- 前端：Next.js 16（App Router）+ React 19 + TypeScript 5
- 服务端：Next.js Route Handler（AI 代理、`/api/sync` 共享存储、`/api/sync/increment-copy` 计数）
- 共享存储：服务端 `data/store.json`（进程内单例 serverStore 落盘，同步源）+ localStorage（离线兜底）
- 实时同步：SSE（`/api/sync/stream`）跨设备推送；`next.config.ts` `allowedDevOrigins` 放行局域网来源
- MCP：`mcp/prompt-server/`（`@modelcontextprotocol/sdk` + zod，stdio），工具 `prompt_manager_activate_prompt`（按调取码激活系统提示词并计入复制次数）
- 样式方案：Tailwind CSS v4
- 代码检查：ESLint 9（eslint-config-next）
- 测试方案：暂无（待建立）
- 部署平台：待定

### 常用命令

- 安装依赖：`npm install`；MCP 子包：`cd mcp/prompt-server && npm install`
- 本地开发：`npm run dev`（或 `./dev-server.sh start` 带 watchdog 自愈）
- 类型检查：`npx tsc --noEmit`（无独立脚本，next build 亦会检查）
- Lint：`npm run lint`
- 构建：`npm run build`；MCP 子包：`cd mcp/prompt-server && npm run build`
- 预览 / 生产启动：`npm run start`
- 服务管理：`./dev-server.sh {start|stop|restart|status|logs}`（watchdog 自愈）
- 测试：暂无脚本（待建立）

### 当前进展与产物索引

- 当前状态：实时同步、UI 优化、调取码、MCP 集成、调用计数、失焦自动保存、P0/P1 8 项修复、全局搜索（P2-2）+ 健壮性批次（RISK-3/OPT-NEW-2/P3-1/P3-3）、P2-8/P2-9/P3-6 三项打包、P0-1~P0-7（含 11合1 总验收 + 2合1）、P0 标签系统核心 22项、Fix chip 双写+重命名回滚+父校验均已完成并推送（`ad5b64e`）；PRODUCT_BACKLOG 已清理 CLOSED 项（P2-1/3/4/5/10/11、P3-1/2/3）；下轮待排期：P0-8 标签重命名调研 + 剩余 P1/P2
- 需求文档：`docs/pm/提示词管理工具-需求文档.md`
- 产品报告：`docs/pm/产品报告.md`
- 实施计划：`docs/pm/PLAN.md`
- 代码审查：`docs/review/CODE_REVIEW.md`
- 产品优化候选：`docs/review/PRODUCT_BACKLOG.md`
- 交接上下文：`docs/handoff/HANDOFF.md`
- MCP 接入说明：`mcp/prompt-server/README.md`
- 用户级模型执行指南（Stage Manager 只读引用）：`/Users/zzymima0000/.workbuddy/AI_MODEL_GUIDE.md`
- 治理文档（工作流 / 角色 / 门控 / 阶段 / 经验）：见 `AGENTS.md` §四
- 远程仓库：https://github.com/wanghoufan/prompt-manager.git（master）

---

## 二、全局工作原则

1. 先理解现有实现，再修改代码。
2. 优先复用现有代码、组件、函数和数据结构。
3. 不擅自增加用户未要求的功能。
4. 不进行与当前任务无关的重构。
5. 尽量减少新增第三方依赖。
6. 修改完成后必须进行必要验证。
7. 不允许通过删除测试、绕过校验、隐藏错误来制造“通过”结果。
8. 代码和实际运行结果优先于过期文档。
9. 发现文档与代码冲突时，应明确记录并修正文档。
10. 密钥、Token、`.env*`、私密配置不得提交到 Git。
11. 临时脚本、实验副本、一次性分析、截图、中间产物统一放入 `scratch/`。
12. 不得把临时垃圾放入正式源码目录。
13. 禁止自行创建重复的项目管理类 Markdown；优先更新已有唯一权威文档。
14. 每个 Agent 只执行自己角色范围内的工作，除非用户明确授权跨角色处理。
15. 不确定时优先检查代码、运行结果和现有文档，不凭猜测下结论。

---

## 三、Agent 角色索引

> 角色规范文件统一放在 `docs/roles/`（已从模板复制建立）。日常启动只发送“中括号关键词 + 角色 + 当前任务”，Agent 自行读本文件与对应角色规范。

### 1. 技术规划师（Planner）
- 角色规范：`docs/roles/planner.md`
- 主要职责：理解需求、检查现有实现、分析影响范围、制定低风险实施方案、更新 `docs/pm/PLAN.md`；完成 PLAN 后检查并按需建立 / 补充 `QA_CHECKLIST.md` 核心回归基线。
- 默认不直接修改业务代码。

### 2. 开发实现工程师（Builder）
- 角色规范：`docs/roles/builder.md`
- 主要职责：按需求 / 计划实现功能、修改源码、基础自测、运行必要检查、修复已确认 Bug。

### 3. 代码审查工程师（Code Reviewer）
- 角色规范：`docs/roles/code-reviewer.md`
- 主要职责：独立审查代码、查找逻辑 Bug、数据一致性问题、性能 / 安全 / 可维护性风险、输出审查结果到 `docs/review/CODE_REVIEW.md`。
- 默认不直接修改业务代码。

### 4. 质量测试工程师（QA / Test Agent）
- 角色规范：`docs/roles/qa.md`
- 主要职责：实际运行和操作产品、正常 / 边界 / 异常 / 连续操作测试、完整实体生命周期测试、回归测试、记录 Bug 到 `docs/qa/BUGS.md`。
- 默认不直接修改业务代码。

### 5. 产品体验审查员（Product Reviewer）
- 角色规范：`docs/roles/product-reviewer.md`
- 主要职责：从产品经理、UX 和真实用户角度审查、发现功能完整性 / 易用性 / 效率 / 一致性问题、提出优化方向、维护 `docs/review/PRODUCT_BACKLOG.md`。
- 不负责传统代码审查。

### 6. 开发节奏与上下文管理（Stage Manager）
- 角色规范：`docs/roles/stage-manager.md`
- 主要职责：唯一的流程判断器；读取 Builder 技术交接 + PLAN + Git + QA / Review / Product 状态后，生成「当前唯一执行 Prompt」。
- 严格限制：本轮不得修改任何项目文件，只生成给 Builder 的执行 Prompt。

### 7. 开发经验记录（Experience Recorder）
- 角色规范：`docs/roles/experience-recorder.md`
- 主要职责：把开发经验、踩坑、协作改进沉淀到 `docs/DEV_EXPERIENCE.md`；相同经验合并、补充、升级成熟度。
- 不得自行升级正式规范（需用户授权）。

### 8. 工程 / 治理洁癖收尾（neat-freak）
- 角色规范：`docs/roles/neat-freak.md`
- 主要职责：Engineering Closeout；检查代码与文档是否一致、各权威文件是否过期、是否存在重复 / 过时 Markdown。
- 适用节点：大阶段完成 / 发布前 / 长会话交接 / 最终交付 / 文档失配时。

> 注：broader 方法论中另有 `【修复】`（Builder 复用 + 多报告综合）与 `【收尾】neat-freak` 两种运行模式，见第十节。

---

## 四、项目文档唯一归属表

| 信息类型 | 唯一权威位置 |
|---|---|
| 项目公共规则 | `AGENTS.md` |
| Agent 工作规范 | `docs/roles/` |
| 当前实施计划 | `docs/pm/PLAN.md` |
| 长期核心回归测试 | `docs/qa/QA_CHECKLIST.md` |
| 当前 Bug | `docs/qa/BUGS.md` |
| 当前代码审查结果 | `docs/review/CODE_REVIEW.md` |
| 产品优化候选 | `docs/review/PRODUCT_BACKLOG.md` |
| 当前交接上下文 | `docs/handoff/HANDOFF.md` |
| 人工编排流程 / 质量 / 收尾门控 | `docs/workflow/` |
| 当前开发阶段 / Builder 技术交接 | `docs/progress/CURRENT_STAGE.md` |
| 开发经验 | `docs/DEV_EXPERIENCE.md` |
| 可选模板（架构 / 决策 / 模型指南）| `docs/optional/` |
| 临时资料 | `scratch/` |

同一事实不要在多个位置重复维护。

---

## 五、Agent 启动规则

每个 Agent 开始工作前：

1. 先阅读根目录 `AGENTS.md`。
2. 确认当前被指定的角色。
3. 阅读该角色对应的 `docs/roles/*.md`。
4. 再读取当前任务真正需要的项目文档。
5. 阅读相关源码和测试。
6. 不要为了“了解项目”一次性读取所有无关文档。
7. 执行完成后，只更新自己职责范围内的权威文件。

---

## 六、角色与文档写权限建议

| 角色 | 源码 | PLAN | QA_CHECKLIST | BUGS | CODE_REVIEW | PRODUCT_BACKLOG |
|---|---:|---:|---:|---:|---:|---:|
| 技术规划师 | 默认否 | 是 | 建议 | 否 | 否 | 建议 |
| 开发实现工程师 | 是 | 可更新状态 | 否 | 可更新修复状态 | 否 | 否 |
| 代码审查工程师 | 否 | 否 | 建议 | 可记录 | 是 | 否 |
| 质量测试工程师 | 否 | 否 | 是 | 是 | 否 | 否 |
| 产品体验审查员 | 否 | 否 | 否 | 否 | 否 | 是 |

用户明确授权时例外。

---

## 七、临时文件规范

以下内容统一放入 `scratch/`，且默认不进入 Git：

- 调试脚本、实验性代码、临时数据
- 一次性分析、中间报告、临时导出
- 截图、试验副本

不得把临时垃圾放入正式源码目录。

---

## 八、文档管理规则

禁止随意新增类似 `FINAL_REPORT.md`、`QA_FINAL.md`、`TEST_SUMMARY_NEW.md`、`REVIEW_LATEST.md` 等重复文档。如果已有对应权威文件，应直接更新。只有现有文档体系无法承载必要信息时，才允许新增文档并说明原因。

进仓库 = `src/`、配置、`docs/` 交付物、真实测试套件；不进仓库 = `scratch/`、密钥、本地笔记、`node_modules/`、构建产物（由 `.gitignore` 强制）。

---

## 九、Git 与安全规则

1. 本项目已 `git init`（远程仓库未配置；首次推送需用户明确授权）。
2. 基线约定完成后建议先提交一次。
3. 阶段性正常 `commit` / `push`。
4. `scratch/`、构建缓存、依赖目录、密钥配置不得提交。
5. `.env*` 默认忽略；如需示例配置，只提交脱敏的 `.env.example`。
6. 不执行远程推送、删除分支、重写历史等高影响操作，除非用户明确授权。

---

## 十、neat-freak 使用约定

`neat-freak` 不用于每次小改动后的例行清理。建议在以下节点执行完整收尾：

- 一个较大开发阶段完成
- MVP / 版本发布前
- 长会话准备交接
- 项目最终交付
- 文档明显开始与代码失配时

收尾时重点检查：

- 当前代码事实与文档是否一致
- `AGENTS.md` 是否过期
- `PLAN.md` 是否仍准确
- 已解决 Bug 是否仍残留在 `BUGS.md`
- `QA_CHECKLIST.md` 是否需要补充长期回归案例
- `PRODUCT_BACKLOG.md` 是否混有已完成事项
- `HANDOFF.md` 是否能让新 Agent 直接接手
- `scratch/` 是否仍有应保留或应删除内容
- 是否存在重复、过时、冲突的 Markdown 文档

普通 commit、小 Bug、小样式改动无需执行完整 neat-freak。
