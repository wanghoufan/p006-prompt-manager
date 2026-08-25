# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。

## 当前目标

围绕「提示词管理工具」的三大增量需求，均已进入开发期：

1. **UI 体验优化**（已完成）：卡片 2 行正文预览、大屏 3 列、右侧面板可拖动宽度、思维总结/版本历史默认折叠。
2. **调取码字段**（已完成）：`Card.code` 用户自定义短码，配合 MCP 供外部 Agent 按码调取。
3. **MCP 集成**（已完成主体）：子包 `mcp/prompt-server/`，`prompt_manager_activate_prompt(code)` 激活卡片为系统提示词；命中后计入 `copyCount`。

## 验收标准

- 卡片显示 2 行正文预览；大屏 3 列；面板可拖动（320–720px，双击重置，宽度持久化）。
- 调取码可填可改可清，冲突实时提示；Markdown 导出/导入含调取码；旧数据兼容（视为未设置）。
- MCP server 编译通过；`initialize/tools/list/call` 正常；命中返回「[系统提示词已切换]」包装；未命中报错。
- MCP 命中后 `/api/sync/increment-copy` 使 `copyCount +1`，落盘 + SSE 广播，未命中 404。
- 跨设备实时同步不受影响；`tsc --noEmit` 与 `npm run lint` 通过。

## 实施方案

- **数据层**：`types.ts` 加 `code`；`cards.ts` 加 `normalizeCode` / `cardDraftFrom` 追踪 code；`storage.ts` `isCard` 兼容 + 导入导出；`serverStore.ts` 加 `incrementCopy`。
- **UI**：`CardItem` 预览与徽标；`PreviewPanel` 可拖动 + 折叠 + 调取码输入；`page.tsx` 网格 3 列 + `allCodes` 冲突检测 + `onUpdateCode`；`CardDetail` 调取码输入。
- **API**：新增 `src/app/api/sync/increment-copy/route.ts`。
- **MCP**：`mcp/prompt-server/`（SDK + zod + stdio），工具读 `data/store.json`，命中后 fire-and-forget 调计数 API。
- **配置**：注册到 `~/.workbuddy/mcp.json`（不带点），WorkBuddy 连接器信任后新会话生效。

## 进行中 / 待办

- 提交并推送工作区改动（需用户授权）。
- 候选优化见 `docs/review/PRODUCT_BACKLOG.md`。
