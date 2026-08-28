# 开发经验 ｜ DEV_EXPERIENCE

> 权威位置：`docs/DEV_EXPERIENCE.md`
> 维护者：Experience Recorder
> 基线：ORCA 治理体系 V2.1 §18

本文件沉淀本项目开发过程中可复用的经验、踩坑与协作改进。由 Experience Recorder 在 `【经验】` 时整理。

## 格式建议
- 标题：一句经验总结
- 成熟度：A 本项目保留 / B 候选升级项目规范 / C 候选升级通用模板
- 小白解释 + 技术处理（面向初学者时）
- 可直接给 Agent 的规则

## 1. 避免使用不稳定的免费模型（0x Alpha Free / OpenCode Zen max）

- 成熟度：B 候选升级项目规范（需用户授权后写入 AGENTS.md / 工作流约束）
- 时间：2026-08-26
- 现象：`Build` / `Build auto` 下的 `0x Alpha Free (Unlimited)` / `OpenCode Zen · max` 频繁出现 `Error from provider (Console): Upstream request failed: Endpoint is unavailable` 及工具调用错误，阻塞开发流程。
- 小白解释：就像请了一个经常失联的助手，叫他干活时他总掉线、工具递不过去，导致整个开发卡住，体验很差。
- 技术处理：该模型 endpoint 不可用率高，且易出现 tool_call 参数错误/中断重试。后续开发在模型选择阶段直接排除该模型，优先选用稳定性已验证的主力模型；若需对比测试，仅在隔离环境验证，不作为主开发模型。
- 可直接给 Agent 的规则：`后续 Build / Build auto 任务禁止选用 0x Alpha Free (Unlimited) / OpenCode Zen (max)，如自动选中需主动切换至稳定模型；遇到 Endpoint is unavailable 重试超过 1 次即提示用户切换模型。`
- 候选升级位置：`AGENTS.md §二 全局工作原则` 或 `docs/workflow/` 模型选用约束（待授权）

## 2. Stage Manager 用命令直达剪贴板，解决 opencode 无法滚轮回看的复制痛点

- 成熟度：B 候选升级项目规范（可同步作为 C 通用模板候选）
- 时间：2026-08-26
- 现象：opencode 界面无法用鼠标滚轮向上回看长输出，Agent 给的长 Prompt 在视口外难以手动选中复制，严重影响“Stage Manager → 下一角色”的接力效率。
- 小白解释：就像聊天记录太长但窗口卡住不能往上翻，想抄上面的作业却够不着。Stage Manager 现在直接帮你把作业一键放到剪贴板，你只需粘贴就行，不用自己去翻和选。
- 技术处理：Stage Manager 承担“阶段划分 + 唯一执行 Prompt 分发”，生成下一角色 Prompt 后不依赖用户手动复制，而是执行 `pbcopy < "/path/to/prompt.md" && echo 已复制到剪贴板`（macOS；Linux 用 `xclip`/`wl-copy`）将文件内容直达系统剪贴板。截图中路径示例：`/var/folders/mp/.../T/opencode/dev-prompt-search-robustness.md`。新会话直接 `Cmd+V` 粘贴即可推进，避免滚轮/选区失效问题。
- 可直接给 Agent 的规则：`Stage Manager 每次生成“当前唯一执行 Prompt”后，必须执行一次剪贴板直达命令（pbcopy < prompt文件 && echo 已复制到剪贴板），并在输出中明确告知“已复制到剪贴板，新会话直接粘贴”；不得仅靠用户手动滚轮复制。`
- 候选升级位置：`docs/roles/stage-manager.md §Prompt 生成契约` 追加“剪贴板直达”条目（待授权）；`docs/workflow/` 协作流程中固化

## 3. 每次给开发者的 Prompt 都必须附带「续会 vs 重开」建议以节省 Token

- 成熟度：B 候选升级项目规范（可同步作为 C 通用模板候选）
- 时间：2026-08-26
- 现象：长会话跑完 P2-8/9/P3-6 全里程碑 + 刚置顶 P0-1~3 后，上下文已重；用户提问“是否要重新起一个会话，还是在原绘画呢？”，Stage Manager 未主动给出会话策略会导致 Token 浪费与 Builder 注意力分散。
- 小白解释：就像书桌堆满旧作业再做新作业会很乱、找东西很慢。桌子重了就换张干净桌子做新的一套，反而更快更省纸（Token）。
- 技术处理：Stage Manager 在生成下一轮 Builder Prompt 时，必须基于上下文重量做判断：已完成大里程碑/刚切换最高优先级包（P0-1~3）→ 建议重开新会话；仅小修补/上下文轻 → 建议原会话继续。给出明确结论 + 2-3 条理由（上下文重量、聚焦度、Token 效率）+ 接力方式（新会话直接粘贴剪贴板 Prompt，本地 `scratch/PROMPT_*.md:1` 备份）。截图结论：建议重开新会话，理由是上下文已重、下一轮是新 P0 包、干净会话利于自测。
- 可直接给 Agent 的规则：`以后凡是给开发者的提示词/开始下一步开发，末尾必须追加一行会话建议：【会话建议：重开新会话 | 原会话继续】+ 理由（上下文重量/优先级切换/Token效率），并给出接力方式（pbcopy 已复制，新会话粘贴即可）。不得遗漏。`
- 候选升级位置：`docs/roles/stage-manager.md §Prompt 生成契约` 新增“会话策略”必填项（待授权）；`AGENTS.md §五 Agent 启动规则` 补充上下文管理条目

## 4. QA 必须真机 GUI 验证，禁止仅代码走查就判 PASS — 三重保障防走过场

- 成熟度：B 候选升级项目规范（需用户授权后写入 `docs/roles/qa.md` / `docs/workflow/QUALITY_GATES.md` / `docs/roles/stage-manager.md`）
- 时间：2026-08-27（2026-08-28 补充三重保障）
- 现象：重命名标签全链路失败这类“用户一用就发现”的 P0 阻断，未被 QA 拦截。QA 第十二次 PASS 仅为 `代码走查 + tsc/lint + curl /api/sync 11/55` 校验，`BUGS.md: 需人工确认` 仅列“未真机点过 TagPanel →重命名→输入→确认 全链路”；`QA_CHECKLIST` 对 P0-13 重命名只有 `renameTag 纯函数/handleRenameTag 重名检测` 走查项，无 GUI 必测项（选中→重命名→新名显隐→关联卡 chip 自动更新→子路径变）；工程收尾 `31b1322` 在 QA GUI 空档期直接提交，门控未拦住。
- 小白解释：就像只看菜谱没尝菜就说菜熟了。看代码觉得逻辑对，不等于在真机上点一点就真能用——用户一点重命名就失败，说明必须亲手在界面上点过才算测过。单靠一条规定容易“走过场”，要用三道锁一起兜底。
- 技术处理：按 `QUALITY_GATES.md` 本应 `P0 可复现 → QA 必 GUI`，但本轮 QA 为 B 档代码走查（`gpt-5.4-mini` 等）未强制 `Vision + Computer Use` 真机。本次已补为三重保障：① Skill `qa-real-device` 隐式加载（第一重，能力层兜底）② 角色模板 `docs/roles/qa.md` 写入“真机必测硬约束”（第二重，角色层）③ `Stage Manager` 生成 QA Prompt 时在“约束”首条显式要求 `Vision + Computer Use 真机操作 http://localhost:3000 必选，截图为据`（第三重，刚写入 `docs/roles/stage-manager.md: QA 真机必测多重保障`）。后续任何 P0 的 QA Prompt 都在约束首条显式要求真机，三重缺一不可，未真机逐项点过不得判 QA PASS。补救已入本次 Fix Prompt：Fix 后 QA 必须真机复测 4 项 GUI（单标签重命名 / 父重命名 / 重名拒绝 / 移动后子路径），`QA_CHECKLIST` 追加 P0 重命名 GUI 必测，`BUGS.md` 记 P0 阻断项，下次 `neat-freak` 前必须 GUI PASS 才能合。
- 可直接给 Agent 的规则：`QA 对 P0 功能必须 Vision + Computer Use 真机点过全链路（选中→操作→显隐→关联数据更新）并截图留证，仅 tsc/lint/走查不得判 PASS；Stage Manager 的 QA Prompt 约束首条必须显式写明真机必选；三重保障（Skill+角色模板+Prompt约束）缺一不可，P0 GUI 未 PASS 禁止 neat-freak 合入与提交。`
- QA 分工差异化（2026-08-28 补充，避免一刀切）：`代码走查（所有任务，读代码+验证逻辑）+ 自动化测试（有 tsc/lint/curl 门禁时，运行构建命令+API 测试）+ 真机 GUI 测试（仅 P0 核心功能：标签重命名/移动/删除等，Vision + Computer Use 操作浏览器，需 Vision 能力模型）`；问题是此前所有 QA 用同一模型/方式，未区分。整改：`P0 核心功能 → 必须真机 GUI`，`P1/P2 常规 → 代码走查 + 自动化测试即可`；后续 QA 任务在 Prompt 中明确标注「真机必测」或「代码走查即可」，Stage Manager 分派时按此分级选用模型/方式（P2-10/P2-11 12 项验证已按此区分通过）。
- 候选升级位置：`docs/roles/qa.md` 增加“P0 必真机 + QA 三档分工”条目 + `docs/workflow/QUALITY_GATES.md` 硬门控 + `docs/qa/QA_CHECKLIST.md` 为 P0-13 追加 GUI 必测项 + `docs/roles/stage-manager.md` 增加 QA 真机多重保障与分工标注（均待授权，已部分写入）

## 5. 派发子任务后必须进入强制监控循环，防 tui-idle 假死导致工作停滞

- 成熟度：B 候选升级项目规范（可同步作为 C 通用模板候选）
- 时间：2026-08-28
- 现象：QA 已启动（`term_6185798f, mimo-v2.5-free` 验 P2-10/P2-11）后无主动巡检，`tui-idle` 假死无感知，任务停滞无超时切换，日志无回溯。
- 小白解释：就像派人去干活后不去看进度，人卡住了也不知道。要每隔十几秒去敲门看一眼，没动静就换人，确保活一直在干。
- 技术处理：整改方案确保工作不停止：① 强制监控循环：派发后立即 `while True`，每 15-30s 主动 `orca terminal wait --for tui-idle --timeout-ms 5000 --json | grep "satisfied"` + `orca terminal read --json | python -c` 取 `tail[10:]` ② 完成标志检测：输出中搜索 `完成后停止/等待 QA/已完成` 等关键词 ③ 超时处理：单任务 >10 分钟无进展则重新派发或切换 fallback 模型 ④ 日志记录：每次检查写入 `scratch/monitor-log.md` 便于回溯。当前监控中每 15s 检查一次：`sleep 15; echo "=== QA 进度检查 ==="; orca terminal wait ...; orca terminal read ...`。
- 可直接给 Agent 的规则：`派发 QA/子任务后必须立即进入 30-45s 轮询的强制监控循环（tui-idle 检测 + 关键词完成检测 + 10分钟超时切 fallback），每次结果 append 到 scratch/monitor-log.md，未完成不得退出循环。`
- 候选升级位置：`docs/roles/stage-manager.md` 或 `docs/workflow/` 增加“子任务监控”硬约束 + `AGENTS.md §六` 补充监控纪律（待授权）

## 6. Codex/子任务调用必须走 ORCA 编排终端直接执行，不向用户反问

- 成熟度：B 候选升级项目规范（需用户授权后写入 `docs/roles/stage-manager.md` / `AGENTS.md`）
- 时间：2026-08-28
- 现象：节奏角色（Stage Manager）不知如何在 opencode 内启动 codex，反复向用户确认“如何调用”，阻塞编排。最后自行从 `~/.codex/models_cache.json` 与 `~/.codex/config.toml` 探明正确模型名 `gpt-5.6-terra（config.toml 默认）/ gpt-5.6-sol（models_cache.json 存在）` 才打通。
- 小白解释：就像调度员不知道怎么叫车，一直问老板“车在哪”，最后自己翻车库清单才找到车。以后调度员应直接照清单叫车，不用再问老板。
- 技术处理：后续一律走 ORCA 编排的终端直调，不反问用户：`orca terminal create -- codex --model gpt-5.6-terra`（或 `gpt-5.6-sol`）或在 opencode TUI 终端直接 `codex --model gpt-5.6-terra`；模型名以 `~/.codex/config.toml` 与 `models_cache.json` 为准，优先用 `terra` 默认。Stage Manager 派发时直接给出可执行命令与终端 ID 监控（复用 #5 的 15-30s 轮询），用户仅需确认结果，无需回答“怎么调”。
- 可直接给 Agent 的规则：`需调用 codex/子 Agent 时，Stage Manager 必须直接通过 orca terminal / opencode 终端执行 codex --model gpt-5.6-terra（或 sol）完成编排，并在 Prompt 中写明终端命令与模型名，禁止反问用户“如何启动/用哪个模型”。`
- 候选升级位置：`docs/roles/stage-manager.md §Prompt 生成契约` 增加“ORCA 终端直调”条目 + `AGENTS.md §三` 补充编排调用规范（待授权）
