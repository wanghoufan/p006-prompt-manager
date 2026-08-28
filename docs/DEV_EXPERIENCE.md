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

## 5. 派发子任务后必须进入强制监控循环，防 tui-idle 假死 — 区分监控节奏控消耗

- 成熟度：B 候选升级项目规范（可同步作为 C 通用模板候选）
- 时间：2026-08-28（2026-08-28 补充差异化节奏）
- 现象：QA 已启动（`term_6185798f, mimo-v2.5-free` 验 P2-10/P2-11）后无主动巡检，`tui-idle` 假死无感知，任务停滞无超时切换，日志无回溯；且若不明确节奏，Stage Manager 要么忘记监控一直等待，要么实时轮询疯狂写入输入输出，消耗失控。
- 小白解释：就像派人去干活后不去看进度，人卡住了也不知道；但也不能每秒都敲门，太吵费电。要按活的时长定敲门间隔。
- 技术处理：整改方案确保工作不停止且控消耗：① 强制监控循环：派发后立即 `while True`，`orca terminal wait --for tui-idle --timeout-ms 5000 --json | grep "satisfied"` + `orca terminal read --json | python -c` 取 `tail[10:]` ② 完成标志检测：搜索 `完成后停止/等待 QA/已完成` 等关键词 ③ 超时处理：单任务 >10 分钟无进展则重新派发或切 fallback 模型 ④ 日志记录：每次检查 append 到 `scratch/monitor-log.md` ⑤ **差异化节奏（本次补充）**：开发任务轮询间隔 **45s**（执行时间长），QA/产品测试轮询间隔 **30s**（执行短需更快反馈），避免“一直等待不监控”与“实时监控刷屏”两个极端，兼顾运转与 Token/IO 消耗。之前 15s 过密已改为此分级。
- 可直接给 Agent 的规则：`派发后必须立即进入强制监控循环：开发 45s 一检，QA/产品 30s 一检（tui-idle + 关键词 + 10分钟超时切 fallback），每次结果 append 到 scratch/monitor-log.md，未完成不得退出。`
- 候选升级位置：`docs/roles/stage-manager.md` 或 `docs/workflow/` 增加“子任务监控差异化节奏”硬约束 + `AGENTS.md §六` 补充监控纪律（待授权）

## 6. Codex/模型调用必须固定清单 + 自动模式直启，不向用户反问打断

- 成熟度：B 候选升级项目规范（需用户授权后写入 `docs/roles/stage-manager.md` / `AGENTS.md` / `docs/DEV_EXPERIENCE.md` 固定清单）
- 时间：2026-08-28（2026-08-28 补充模型固定与自动模式）
- 现象：① 模型固定不下来：节奏角色（Stage Manager）可能不知怎么调用 Codex（用户原话 COD 均指 Codex），每次换一个节奏都要踩坑才学会；② 调用不顺畅：虽启用终端但未以指定模型直接启动，启动的模型与 codex 模型未以自动模式启动，运行中为不危险权限停下询问用户，打断进程。
- 小白解释：就像每次换个调度员都要现找车和钥匙，还要每过一个路口就停车问老板“能过吗”。应把车单和钥匙固定好，一次性给足权限，让车自己跑完不中途停车问人。
- 技术处理：① **固定清单**：将可用模型固化为 `gpt-5.6-terra（~/.codex/config.toml 默认）/ gpt-5.6-sol（~/.codex/models_cache.json 存在）` + 当前 opencode 可用模型，不每次现探；Stage Manager 换人也照清单直接调，不重复踩坑。② **指定模型直启**：一律 `orca terminal send --terminal <handle> --text "codex -m gpt-5.6-terra -c model_reasoning_effort=medium --approve-for-me" --enter`（`~/.config/opencode/skills/orca-codex-commands/SKILL.md:23` 节奏已修正），而非 `orca terminal create -- codex --model ...` 裸启动。③ **自动模式直启**：必须加 `--approve-for-me`（此前误用 `--approval-mode auto/--yolo`），否则 Codex 会中途询问权限打断开发进程；同时 `--text` 非 `--message`，必须加 `--enter` 否则不执行。复用 #5 的差异化监控（开发 45s / QA 30s）持续巡检，无需用户中途介入。
- 可直接给 Agent 的规则：`Stage Manager 必须按固定清单直接以指定模型+自动模式启动（codex -m gpt-5.6-terra -c model_reasoning_effort=medium --approve-for-me），通过 orca terminal send --terminal <handle> --text "..." --enter 直调，并在 Prompt 中写明完整命令，禁止反问用户如何启动/模型固定不下/中途问权限。`
- 候选升级位置：`docs/roles/stage-manager.md §Prompt 生成契约` 增加“ORCA 终端直调+固定清单+自动模式”条目 + `AGENTS.md §三` 补充编排调用规范 + `docs/DEV_EXPERIENCE.md` 置顶固定模型清单（待授权）

## 7. Orca 终端调用 Codex 的完整命令与踩坑记录

- 成熟度：A 本项目保留（已验证可复用）
- 时间：2026-08-28（2026-08-28 补充 --approve-for-me 参数）
- 现象：Stage Manager 调用 Codex 时多次踩坑：① Orca dispatch 格式错误（用 `--task-id` 应为 `--task`）② 消息格式错误（用 `--message` 应为 `--text`）③ 终端关闭后需重新创建 ④ 不知道如何正确启动和监控 Codex ⑤ **Codex 询问权限打断开发进程**
- 小白解释：就像打电话拨错号码、说错暗号、电话断了不知道怎么重拨、电话那头还一直问"你确定要打吗？"。现在把正确的号码、暗号、重拨方法、如何让电话那头别再问都记下来，以后直接照着打。
- 技术处理：
  - **创建终端**：`orca terminal create --json` → 获取 `handle`
  - **启动 Codex**：`orca terminal send --terminal <handle> --text "codex -m gpt-5.6-terra -c model_reasoning_effort=medium --approve-for-me" --enter`
  - **等待启动**：`orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 10000 --json`
  - **发送任务**：`orca terminal send --terminal <handle> --text "任务描述" --enter`
  - **监控进度**：`orca terminal read --terminal <handle> --tail 50 --json`
  - **检查状态**：`orca terminal read --terminal <handle> --json` → 查看 `status`
  - **踩坑教训**：① `orca terminal create` 不带 `--command` 参数，先创建空终端再 send 命令 ② `--text` 不是 `--message` ③ `--enter` 参数必须加，否则命令不执行 ④ 终端关闭后需重新 `create` 并重新启动 Codex ⑤ **必须加 `--approve-for-me` 参数，否则 Codex 会询问权限打断开发进程**
- 可直接给 Agent 的规则：`Stage Manager 调用 Codex 必须按以下步骤：1) orca terminal create --json 获取 handle 2) orca terminal send --terminal <handle> --text "codex -m <model> -c model_reasoning_effort=medium --approve-for-me" --enter 3) orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 10000 --json 4) orca terminal send --terminal <handle> --text "任务描述" --enter 5) orca terminal read --terminal <handle> --tail 50 --json 监控。禁止用 --message（应为 --text）、禁止用 --task-id（应为 --task）、禁止不带 --enter、**禁止不带 --approve-for-me**。`
- 候选升级位置：`docs/roles/stage-manager.md §Prompt 生成契约` 增加“Orca 终端调用 Codex 标准流程”条目（待授权）

## 8. Stage Manager 派发任务后必须关闭已完成的终端标签

- 成熟度：A 本项目保留（已验证可复用）
- 时间：2026-08-28
- 现象：Stage Manager 派发任务给 Builder/QA/Product/Closeout 后，终端标签一直保留在界面上，占用空间且容易混淆。用户反馈"不要让他一直保留在标签上占用空间"。
- 小白解释：就像派人去干活后，工位一直空着不收拾，桌子越堆越乱。活干完了就应该收拾干净，留出空间给下一个人。
- 技术处理：
  - **关闭时机**：当角色完成任务且 Stage Manager 确认结果无误后，立即关闭其终端标签
  - **关闭命令**：`orca terminal close --terminal <handle> --json`
  - **不关闭的情况**：用户自己创建的终端标签不能关闭，只关闭 Stage Manager 派发任务时创建的终端
  - **终端管理流程**：1) 创建终端 → 2) 启动角色 → 3) 发送任务 → 4) 监控进度 → 5) 确认完成 → 6) 关闭终端
- 可直接给 Agent 的规则：`Stage Manager 在确认角色完成任务且结果无误后，必须立即关闭其终端标签（orca terminal close --terminal <handle>），只保留用户自己创建的终端。终端管理流程：创建→启动→发送任务→监控→确认完成→关闭。`
- 候选升级位置：`docs/roles/stage-manager.md §终端管理` 增加"任务完成后关闭标签"硬约束（待授权）

## 9. QA优化框架：自动化优先 + 角色边界清晰

- 成熟度：A 本项目保留（已验证可复用）
- 时间：2026-08-28
- 现象：QA Agent 每次都从头检查所有功能，包括已经被自动化测试覆盖的机械功能，浪费Token且效率低下。同时QA、Product、Visual角色边界不清，导致体验问题被QA直接决定修复，而不是路由到正确的角色。
- 小白解释：就像让医生去做体检报告已经做过的检查，浪费时间和金钱。应该先看体检报告，医生只负责检查报告覆盖不到的项目。同时，医生发现的美观问题应该交给设计师，而不是自己决定怎么改。
- 技术处理：
  - **调用QA前先读取自动化结果**：Build/Unit/Integration/API/Playwright结果
  - **机械功能不重复检查**：如果自动化已充分验证，QA不重复浪费Token
  - **真人式QA只负责自动化覆盖不到的**：焦点、拖拽、弹窗、快捷键、跨应用、多窗口、用户理解、异常操作、实际桌面体验
  - **角色边界清晰**：
    - QA：功能是否正确？是否存在工程缺陷？关注functional correctness、regression、logs、Console、Network、DOM、状态、异常路径、真实操作Bug
    - Product Reviewer：好不好用？用户会不会困惑？按钮难不难找、用户是否知道下一步、流程是否反直觉、文案是否让人困惑、误操作风险
    - Visual Acceptance：好不好看？视觉完成度是否达到可接受标准？间距、遮挡、对齐、层级、视觉Bug、响应式视觉、组件状态完整度
  - **体验问题路由**：真人QA发现体验问题，不代表QA自己决定修；Task Manager分类后路由到Product / Visual / Backlog
- 可直接给 Agent 的规则：`Stage Manager 调用QA前必须先读取自动化测试结果（Build/Unit/Integration/API/Playwright），如果机械功能已被自动化充分验证，QA不重复检查同一件事。真人式QA只负责自动化覆盖不到的：焦点、拖拽、弹窗、快捷键、跨应用、多窗口、用户理解、异常操作、实际桌面体验。QA发现体验问题后，Task Manager分类后路由到Product / Visual / Backlog，QA不直接决定修复。`
- 候选升级位置：`docs/roles/qa.md` 增加"自动化优先 + 角色边界"硬约束 + `docs/workflow/QUALITY_GATES.md` 增加QA前读取自动化结果的门控（待授权）
