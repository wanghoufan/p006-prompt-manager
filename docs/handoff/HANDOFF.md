# HANDOFF｜交接（暂停/恢复用，先读我）

> 2026-09-27 更新。旧交接全文备份为 `HANDOFF.md.旧版-2026-09-13`（1900+ 行，§16.28补4 现役入口），历史不断，断会话靠它接续。

- Captured at（YYYY-MM-DD HH:MM）：2026-09-27 18:30
- PROJECT_PHASE：DEVELOP（现状运行期；Mini 单设备，日常使用与被动故障响应）
- PLAN_VERSION：（无）
- PLAN_READINESS_SCORE：（无）
- PLAN_GATE：（N/A，非 PLAN 链）
- DEV_BASELINE：STATUS-QUO-2026-09-27（本轮 4 次提交已上线：`7e6ff51` 格式整理去竖杠 → `94e5806` 自动格式整理复选框 → `7d286d8` 防重复提交+清理 ┃ → `b07e616` 多选模式点击卡片任意位置选中）
- CHANGE_REQUEST：NONE
- Stage ID（本阶段叫什么）：现状运行期
- 剩 P0（没完的才列，多一条都不行）：
  - 10 个非 `__` 前缀疑似测试标签去留待用户定（部分带真实卡关联）
- 当前 Task（正干到哪）：本轮格式整理 + 多选优化已完成并上线，无开发中 Task
- 执行链/Session：—
- 未闭环评审意见：无
- docs 落盘清单：本文件（HANDOFF.md）
- 下一步（Next Single Action）：
  1. **删除确认弹窗替换**：用户要求不用浏览器原生 `window.confirm`，改为跟随鼠标焦点的自定义确认弹窗。涉及 `page.tsx`（单删/批量删/清空仓库/导入覆盖/载入示例/内容重复）、`TagPanel.tsx`（标签删除/批量删除）、`TrashModal.tsx`（清空回收站）共 10 处 `window.confirm`。
  2. **多选模式入口**：用户反馈找不到多选入口。当前多选只能从卡片右上角勾选框开始，需在 SortBar 或工具栏添加明显的"多选"按钮进入多选模式。
  3. 用户定 10 个疑似标签去留
- 人要拍什么板：无
- permission_request：无
- 收尾记一笔：本轮 4 次提交均已部署上线（HTTP 200 验证通过）

## 本轮已上线改动（2026-09-27）

| 提交 | 改动 | 文件 |
|---|---|---|
| `7e6ff51` | 格式整理 prompt 新增清理竖杠 `|` | `src/lib/ai.ts` |
| `94e5806` | Composer 新增"自动格式整理"复选框 | `src/components/Composer.tsx`、`src/app/page.tsx` |
| `7d286d8` | 防重复提交 + 清理 `┃` 字符 | `src/components/Composer.tsx`、`src/lib/ai.ts` |
| `b07e616` | 多选模式点击卡片任意位置选中 | `src/components/CardItem.tsx` |

## 待办改动详情

### 1. 删除确认弹窗替换（P1）

**需求**：不用浏览器原生 `window.confirm`，改为跟随鼠标焦点的自定义确认弹窗。

**涉及文件与行号**：
- `src/app/page.tsx`：1091（内容重复）、1129（载入示例）、1161（清空仓库）、1381（单删）、1705（批量删）、1863（导入覆盖）
- `src/components/TagPanel.tsx`：518、578、680
- `src/components/TrashModal.tsx`：45

**实现建议**：创建 `ConfirmPopover` 组件，定位在鼠标位置，确认/取消按钮，自动消失。

### 2. 多选模式入口（P1）

**需求**：用户找不到多选模式入口，需要明显按钮进入多选模式。

**当前状态**：多选只能从卡片右上角勾选框开始（hover 才显示），无全局入口。

**实现建议**：在 SortBar 或 Composer 附近添加"多选"按钮，点击进入多选模式（bulkActive=true），再点卡片即选中。

## 恢复读盘（全体系唯一顺序，别乱）

1. AGENTS；2. 角色卡；3. 根 `USER_MODEL_OVERRIDE.md`（现为软链，指母版真源）；4. 本 HANDOFF；5. 根 `经验一句话.md`；6. 任务目标放最后。
冲突才扩大读。
