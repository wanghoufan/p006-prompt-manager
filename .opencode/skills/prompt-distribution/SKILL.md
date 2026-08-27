---
name: prompt-distribution
description: 当 Stage Manager 向单个角色分发下一步 Prompt 时使用；确保通过 pbcopy 复制到剪贴板并同步保存为 scratch/PROMPT_*.md 本地备份，防止剪贴板失效。
---

# 提示词分发 — 剪贴板 + 本地备份（中文）

> 适用：Stage Manager 向 Builder / QA / Product / neat-freak 等单角色分发「当前唯一执行 Prompt」时。

## 硬性约定（2026-08-27 用户确认）

向单个角色分发单条 Prompt 时，**必须同时完成两项**：

1. 执行 `pbcopy < prompt文件` 直达剪贴板（macOS 用 `pbcopy`，Linux 用 `xclip`/`wl-copy`），并回显“已复制到剪贴板”
2. 将同一份 Prompt 落盘为本地备份：`scratch/PROMPT_*.md`（命名含 Stage/日期/P编号），如存在 `.worktrees/<id>/scratch/` 则同步复制

两项均为硬性要求，只做一项即视为违规。

## 操作步骤

1. 将 Prompt 写入 `/tmp/opencode/<名称>.md` 与 `scratch/PROMPT_<Stage>.md`
2. 执行 `pbcopy < /tmp/opencode/<名称>.md && echo "已复制到剪贴板"`
3. 如存在 `.worktrees/`，同步 `cp` 到各工位的 `scratch/` 目录
4. 向用户报告两个位置，并提示“剪贴板已复制 + 本地备份 scratch/PROMPT_*.md”

## 常见错误

- 只复制到剪贴板，未写本地备份
- 只写本地备份，未执行 pbcopy
- 一次生成多条 Prompt（Stage Manager 每次只生成一条当前 Prompt）
