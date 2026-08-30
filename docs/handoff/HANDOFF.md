# 交接上下文 — 2026-08-30 AI 服务集成

## 当前状态
- **分支**: `master`（最新）
- **提交**: `9aefb19`
- **功能**: AI 服务集成已完成（9 个服务商）

## AI 服务接入状态
| 服务商 | 状态 | 模型数 | 说明 |
|--------|------|--------|------|
| DeepSeek | ✅ | 3 | v4-pro, v4-flash-vision-exp, v4-flash |
| 智谱（GLM） | ✅ | 10 | glm-5.3 系列 + glm-4 系列 |
| 豆包 | ✅ | 6 | doubao-seed-2-1/2-0 系列 |
| Kimi | ✅ | 7 | kimi-k3/k2.7/k2.6/k2.5 + moonshot-v1 |
| Google Gemini | ✅ | 3 | gemini-2.5-pro/flash, gemini-1.5-flash |
| OpenAI | ✅ | 4 | gpt-4o/mini/turbo/3.5-turbo |
| OpenRouter | ✅ | auto | 支持自定义模型输入 |
| OpenCode（免费） | ✅ | 7 | hy3-free, ling-3.0-flash-fin-free 等 |
| OpenCode Go（$10/月） | ✅ | 28 | grok-4.6, gpt-5.6-luna, deepseek 等 |

## 已完成的 P0/P2 任务（全部已合并到 master）
- P0-A~I：安全闭环、标签系统、MCP 集成等 11 项
- P2-1~I1：正文格式、撤销、抽屉等 8 项
- AI 服务集成：9 个服务商接入、模型列表维护、QA 全量测试

## 模型分工（用户强制要求，不可更改）
- Stage Manager: mimo-v2.5-free（固定，只编排不改代码）
- QA: codex -m gpt-5.6-luna -c model_reasoning_effort=medium --approve-for-me
- 产品: opencode --auto -m opencode/muse-spark-1.2-contributor-free
- 收尾: opencode --auto -m opencode/nemotron-3-ultra-free
- 初级开发: codex -m gpt-5.6-terra -c model_reasoning_effort=medium --approve-for-me
- 高级开发: codex -m gpt-5.6-sol -c model_reasoning_effort=medium --approve-for-me

## 重要规则
1. Stage Manager 不直接修改代码，只调度其他角色完成
2. 所有 codex 启动必须带 --approve-for-me 参数
3. QA 验证：普通网页功能优先用 Playwright/Orca Built-in Browser，仅桌面/快捷键/权限/剪贴板/跨应用场景用 Computer Use
4. 每次大改动后 Stage Manager 负责 git commit/push

## 关键文件
- `src/components/SettingsModal.tsx`: AI 服务配置界面（9 个服务商、模型列表、测试连接）
- `src/lib/ai/opencode.ts`: OpenCode Zen 适配器（4 种端点格式、reasoning 回退）
- `src/lib/ai.ts`: AI 服务路由（resolveAIConfig、configOverrideFromHeaders）
- `src/lib/storage.ts`: 设置持久化（normalizeSettings、AI_PROVIDERS 白名单）
- `src/app/page.tsx`: 设置状态管理（SSE 同步、localStorage 持久化）

## Dev Server
- 运行在 `http://localhost:3100`
- 使用 `./dev-server.sh` watchdog 管理
