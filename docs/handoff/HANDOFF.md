# HANDOFF｜交接（暂停/恢复用，先读我）

> 结构固定：§0 常驻指针 / §1 当前进展 / §2 下一步 / §3 未完成 / §4 红线 / §5 三日流水 / §6 接续提示词。
> 事实与踩坑不入正文：架构/构建 → `docs/architecture-facts.md`；风险 → `docs/risks.md`；踩坑 → `agent.md`。
> 最后一次更新：2026-10-31。

## §0 常驻指针

| 要查什么 | 去哪 |
|---|---|
| 架构、构建命令、MCP 两条路径、文件地图 | `docs/architecture-facts.md` |
| 已知风险（离线包快照 / 模型不调工具 / 账本债…） | `docs/risks.md` |
| 踩坑与解法 | `agent.md`（**本地文件，被 `.gitignore` 忽略、不入库**；同一台机器直接读，换机器需口头交接） |
| 自审与实测证据 | `docs/review/CODE_REVIEW.md` §八；`docs/qa/BUGS.md`「MCP…」各节 |
| 线上分享页（给别人预览） | https://wanghoufan.github.io/p006-prompt-manager/ |
| 部署方式 | 部署副本 `~/Developer/coding/docker/prompt-manager/` 跑 `bash scripts/deploy.sh`（先 `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"`） |
| 生产 | 容器 `prompt-manager-prompt-manager-1`，`0.0.0.0:3100`，地址用本机当前 LAN IP（`.60` 已漂移过一次，以 `ifconfig` 现查为准） |
| 远端 | `github.com/wanghoufan/p006-prompt-manager`，分支 **`master`**（远程无 `main`，推 `main` 会造孤立分支并断部署） |

## §1 当前进展

- **2026-10-31｜MCP 离线接入包已上线**（`ca7a363` + `6697801`，Pages run `41216093858` success）。
  试用版的 MCP 由「整体隐藏」变为可用；本地完整版修掉写死开发机绝对路径的缺陷。
- 2026-10-31｜接入台收敛为两步：① 复制安装指令（**只复制，不下载**，文本自带完整脚本）
  ② 对 AI 说「调取码 xxx」。其余全部折叠。
- 2026-10-31｜试用版首次打开**播种一张试调取卡**（调取码 `hi`，正文「你是什么模型，你能做什么」）；
  已测：刷新不重复、删了不复活、已有数据的访客不受影响。
- 2026-10-31｜真实智能体验证：codex 0.164.0 连跑 3 次「调取码 hi」→ **3/3 命中**并触发模型自报身份；
  opencode 1.19.4 拿到 `tool_use` 事件。
- 生产数据量级：约 158 卡 / 12 个调取码（2026-10-31 只读查询，会变，交接时以现查为准）。

## §2 下一步

1. **本地 Docker 尚未部署**（仍在旧镜像，3100 上看不到接入台）。是否部署先问用户。
2. **WorkBuddy 未由我终验**：配置已指向离线包并解除禁用，用户已用「记忆文档写明用法」验证可用。
3. P2：wipe 后恢复本机数据会多发 1~2 次空推（要求 ≤2，实测 3）。
4. P1（用户未拍板）：批量删除后不自动退出多选；`Stars` 的 `role` 建议改 `group`；
   导入/批量删除的异步确认窗口期闭包可能陈旧；`readTrash` 水合告警（改法有「先毁后读」风险，别照抄旧方案）。
5. 产品验收矩阵 20 条仍 PASS 2 / DEGRADED 11 / 未测 9（性价比低，先问用户再投入）。

## §3 未完成

- **账本入库被阻**：`TASK-MODEL-LOG.jsonl` 本轮行已落盘但未入库。原因是 `check-ledger` 存量失败
  （`DISPATCH-LOG` 有 6 处 `runtime` 枚举外写法；2026-09-30 一条两账 result 口径不同）。
  按「禁改写历史实绩」本轮未动，待治理批次统一清。
- **pre-commit 钩子缺陷已修但源脚本未入库**：`scripts/pre-commit-guard.sh` 规则②原先把母版口径无条件
  套到项目仓，导致项目仓永远无法提交自己的账本。已改为分仓判定并重装 `.git/hooks/pre-commit`
  （旧版备份 `pre-commit.bak-2026-10-31`）；该脚本仍属铺包批次的未跟踪文件。
- 本机 `~/.prompt-manager-mcp/` 现放「只含 `hi` 一张卡」的测试包；真实库那份备份在同目录
  `.bak-before-hi-test`，要继续用真实库时换回即可。

## §4 红线

- commit / push 需用户明确指令；只推 `master`。
- 未经授权不动 `~/DockerData/`、部署副本、`~/DockerBackups/`；生产库**只读**查询可用。
- 不碰 secrets，`.env*` 不入库；不把私钥、令牌写进文档或日志。
- 测试全 headless，**禁抢用户前台**；临时文件放仓内 `scratch/`，禁写 `/tmp`。
- 不把没测的写成 PASS；不为通过而删测试、跳过用例或降阈值。
- 体系红线（`AGENTS.md` ORCA 段）继续适用：产品验收未落盘、关键 AC 未测不得报完工；首次发布须用户签收。

## §5 三日流水（2026-10-29 起）

- 10-31｜MCP 离线接入包：需求 → 方案（零依赖 stdio + 数据内嵌）→ 三轮返修
  （分步骤被否 → 下载文件被否 → 话术改「调取码」）→ 上线 → 真实智能体 3/3 验证。
- 10-31｜修 pre-commit 钩子「母版口径误套项目仓」（项目仓无法提交账本）。
- 10-29｜README 重写与示例库截图更新（`4338413`）。

## §6 接续提示词

先读 `docs/handoff/HANDOFF.md` §0–§5，再按指针读 `docs/architecture-facts.md`、`docs/risks.md`、`agent.md`，然后动代码。
优先按 §2 推进（本地 Docker 是否部署先问用户），改动前用隔离库 + headless 实测，改完按交付单元补 `docs/review/` 与 `docs/qa/` 留痕。