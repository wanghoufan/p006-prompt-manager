# 交接上下文 — 2026-08-28 模型切换

## 当前状态
- **分支**: `feat/p2-batch` 已推送到GitHub
- **提交**: `4d27cda`
- **待合并PR**: #1 (feat/p0-h-mcp-copy-prompts → master，已合并)

## 已完成的P0级任务（全部已合并到master）
| 任务 | 状态 |
|------|------|
| P0-A 安全闭环 | ✅ |
| P0-B 标签合并与批量移除 | ✅ |
| P0-C 可组合标签筛选 | ✅ |
| P0-8 标签体系完善 | ✅ |
| P0-9 标签添加交互重构 | ✅ |
| P0-D 标签切换逻辑修复 | ✅ |
| P0-E 标签拖拽功能实现 | ✅ |
| P0-F 右侧预览面板排版优化 | ✅ |
| P0-G MCP连接说明文档 | ✅ |
| P0-H MCP连接一键复制提示词 | ✅ |
| P0-I 正文区域格式整理功能 | ✅ |

## 本轮完成的P2优化项
| 任务 | 状态 | 提交 |
|------|------|------|
| P2-1 正文失焦不建版本 | ✅ | 4d27cda |
| P2-4 备注防抖定时器清理 | ✅ | 4d27cda |
| P2-6 弹窗内评分守卫 | ✅ | 4d27cda |
| P2-7 空/离线态文案区分 | ✅ | 4d27cda |
| P0-I格式整理修复 | ✅ | 4d27cda |
| P2-I1 CardDetail格式整理入口 | ✅ | 4d27cda |
| Orca MCP提示词v2 | ✅ | 4d27cda |

## 剩余P2优化项（未排期）
1. P2-5 危险操作撤销（删除单卡/清空仓库/覆盖式导入/载入示例）
2. P2-3 右侧预览面板在 `<md` 完全隐藏

## 模型分工（用户强制要求，不可更改）
- Stage Manager: mimo-v2.5-free（固定，只编排不改代码）
- QA: codex -m gpt-5.6-luna -c model_reasoning_effort=medium --approve-for-me
- 产品: opencode --auto -m opencode/muse-spark-1.2-contributor-free
- 收尾: opencode --auto -m opencode/nemotron-3-ultra-free
- 初级开发: codex -m gpt-5.6-terra -c model_reasoning_effort=medium --approve-for-me
- 高级开发: codex -m gpt-5.6-sol -c model_reasoning_effort=medium --approve-for-me

## 重要规则
1. Stage Manager不直接修改代码，只调度其他角色完成
2. 所有codex启动必须带--approve-for-me参数
3. QA验证：普通网页功能优先用Playwright/Orca Built-in Browser，仅桌面/快捷键/权限/剪贴板/跨应用场景用Computer Use
4. 每次大改动后Stage Manager负责git commit/push

## 关键文件
- `src/components/PreviewPanel.tsx`: 格式整理按钮+runBodyFormat
- `src/components/CardDetail.tsx`: P2-I1新增格式整理入口
- `src/components/SettingsModal.tsx`: Orca MCP提示词v2
- `src/lib/cards.ts`: normalizeBody移除所有前导空格
- `src/lib/ai.ts`: formatBody AI提示更新
- `src/app/page.tsx`: CardDetail props传递bodyAlignment

## Dev Server
- 运行在 `http://localhost:3000`
- 使用 `./dev-server.sh` watchdog管理
