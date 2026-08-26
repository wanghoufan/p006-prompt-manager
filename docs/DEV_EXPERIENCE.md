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
