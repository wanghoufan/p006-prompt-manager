# 实施计划（PLAN）

> 当前需求的验收标准与实施方案。由技术规划师（Planner）维护；完成 `PLAN.md` 后须检查并按需建立 / 补充 `docs/qa/QA_CHECKLIST.md` 核心回归基线。
> P0级用户反馈问题整改（P0-D/P0-E/P0-F/P0-G/P0-H）（2026-08-28，QA验收通过）已交付；P0-A 安全闭环已交付。**Supabase 云端多端同步迁移已完成（2026-09-01~09-03），收口材料最终版（2026-09-03 修订版）待审通过后发布已获批**；当前为 Mini 单设备安全运行期，剩余 P1/P2/P3 观察项见下方「2026-09-03 收口审查裁定后状态」。

## 当前目标

### Supabase 云端多端同步迁移（2026-09-01，已完成 ✅；2026-09-03 审核 APPROVED_FOR_EXECUTION）

**目标**：把提示词管理器迁移到共享 Supabase 项目的独立 `prompt_manager` Schema；以记录级读写、Supabase Auth、RLS、Realtime 和记录级 `revision` 替代当前 `data/store.json` 整快照覆盖与进程内 SSE。

**当前事实（2026-09-03 已验证）**：

- 同步源已切换为 **Supabase `prompt_manager` Schema**（记录级 `revision` 写入，Realtime 订阅 cards/card_versions/tags/prompt_tags/settings 5 表）；旧 `serverStore` + `data/store.json` + `/api/sync` + SSE 仅作未登录/离线兼容兜底（已获 APPROVED_FOR_EXECUTION；限期退场草稿已于 2026-09-04 经用户最终裁定取消、长期保留）。
- `localStorage` 为本机离线缓存；MCP 已直连 Supabase RPC `activate_prompt`（不再读 `data/store.json`，不使用 `service_role`）。
- 数据已完成 UUID 映射与去重导入（52 基线 + 1 授权补传 → 53；当前 54 含 1 张保留测试卡），外键孤儿 0。
- 共享数据库平台仓库位于 `/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库`（HEAD `2e92f08`，Remote 7/7 已发布，含 `20260901152616`/`20260901152750`/`20260901163555`/`20260903141849`/`20260903160500`/`20260903235600` + `20260904102000` BUG-13 修复；已 `supabase link`，管理员隔离重放零错误）；Data API 自定义 Schema 已暴露，RLS 6 表×4 策略已启用。

**实施边界**：

- 本仓库负责业务 UI、Supabase 客户端、Repository、Auth 会话、迁移导入工具和 MCP 改造。
- 独立的共享数据库平台仓库负责 `prompt_manager` Schema Migration；禁止在 Supabase Dashboard 手工建表后不补 Migration，禁止本仓库和其他工具并发执行生产 `db push`。
- `aiApiKey` 继续仅保存在本机 localStorage；不得迁移、日志化或同步。所有 `NEXT_PUBLIC_*` 变量只能是 Supabase URL 与 publishable key，绝不放 Secret/service_role。
- 切换前保留现有 JSON 同步；只有云端 Schema、RLS、Realtime、导入和双端验收全部通过后才删除或停用旧链路。

**目标模型**：

| 表 | 责任 | 关键字段/约束 |
|---|---|---|
| `prompt_manager.cards` | 提示词主体 | UUID、`owner_user_id`、`revision`、`updated_at`、调取码唯一性、评分/复制次数检查 |
| `prompt_manager.card_versions` | 正文历史 | UUID、卡片外键、所有者、创建时间；保留最近 10 条 |
| `prompt_manager.tags` | 标签树 | UUID、自引用父标签、同父同名唯一、所有者、排序字段 |
| `prompt_manager.prompt_tags` | 卡片-标签关系 | 复合主键/唯一约束、卡片/标签外键、所有者一致性 |
| `prompt_manager.settings` | 共享非敏感设置 | 每位用户一行；不含 `aiApiKey` |

**实施步骤**：

1. 用户确认共享 Supabase 项目、现有 Auth 方式、唯一导入数据源与 MCP 云端访问范围；建立/定位独立共享数据库平台仓库。
2. 在平台仓库创建可审查 Migration：Schema、表、索引、外键、RLS、最小 grants、Realtime publication、必要的 `security invoker` 原子 RPC；在隔离环境验证后由唯一发布者执行生产发布。
3. 在本仓库增加不含 Secret 的 `.env.example`、Supabase 浏览器/服务端客户端和 Repository；Auth 使用当前用户会话，UI 不直接使用 service role。
4. 替换 `serverStore` / `/api/sync` 整快照写入：卡片、标签、关系、设置分别进行记录级 mutation；卡片更新带 `revision`，冲突时刷新该记录并给出明确提示。
5. 用 Realtime 订阅 `prompt_manager` 目标表，处理 INSERT/UPDATE/DELETE、断线重连与本机回声；不以 Realtime 代替初始查询。
6. 导入前冻结旧写入，导出各设备候选数据；校验并生成 UUID 映射后一次导入，保留本地备份且不提交 Git。
7. MCP 改为受限云端读取与原子复制计数；不得再直接读取 `data/store.json`，不得配置 Supabase service_role。
8. ✅ 完成双向 CRUD、版本冲突、标签关系、Auth/RLS 越权、MCP、断线重连、恢复演练验收；⏳ 旧 JSON 同步停用按裁定限期提交独立变更申请（不长期维持）。

**当前实施记录（2026-09-02～09-03，已闭环）**：已增加浏览器 Supabase 客户端、Magic Link UI、Google OAuth PKCE 与登录态切换后的自动重连；应用已接入 Supabase 初始读取、Realtime 5 表订阅、卡片/标签/关系/设置的记录级 `revision` 写入（串行、先增后删、追加式版本）。三份本地来源（33+47+47）合并导入 52 基线 + 1 授权补传（`1fdc91aa-…`）→ 当前 54（含 1 保留测试卡）；外键孤儿 0，`aiApiKey` 未入云。MCP 已直连受限 RPC `activate_prompt`（每设备独立令牌、库内仅哈希），设置页可生成/撤销。BUG-11 四项修复（connect 代次序列化/登录态锁定云端+重试态/null-throw区分/auth 去抖）已部署并经 Air↔Mini 真机复测 0–4 闭环；并发冲突、MCP 双设备隔离、BUG-9/10 Mini 复测均通过；55 卡基线备份 + 隔离恢复演练全绿（`DockerBackups/prompt-manager/`，生产零写入）。收口材料 `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md` 已于 2026-09-03 修订为最终版（L0–L5 全部 ✅ / L5 裁定待给出）。

**2026-09-03 审查裁定后状态（APPROVED_FOR_EXECUTION）**：共享 Supabase 数据库管理员 14:46–15:00 独立核验——待审 Migration `20260901163555`（1,732 B，`83dc8b36…`）与线上语义一致、平台仓库 `2e92f08` 已 `supabase link` + Remote 7/7（含 BUG-13 `20260904102000`）隔离重放零错误 + RPC/RLS 冒烟一致。裁定：① SECURITY DEFINER 接受（2 WARN 存档）；② `20260901163555` 批准发布；③ 收口放行；④ 旧链路要求限期退场（后于 2026-09-04 经用户最终裁定取消，长期保留）；⑤ 授权补传追认合规。**2026-09-04 增量**：BUG-13 `tags.revision` 漏建已于 `20260904102000` 修复并发布（7/7），剩余待办已于当日经用户最终裁定全部取消，项目进入现状运行期。详见裁定与转送清单。

**风险与决策（2026-09-03 更新）**：

- 未确认哪台设备拥有完整数据前，禁止导入或切换；否则可能丢失另一端的本地记录。（已解决：52+1 已导入，当前 54）
- 若保留离线编辑，必须实现按记录保存的离线操作队列及重放冲突处理；第一阶段可先提供只读缓存/导出，不能继续“恢复后整快照推送”。（已实现：`revision` 条件更新 + 串行写队列；PM-3 写队列 30s 超时自愈已部署，冲突回归按用户决定搁置）
- MCP 需要独立、可撤销的用户级访问方式；此项与浏览器 Supabase 登录会话不同，必须在实施前确认。（已解决：`api/mcp-access-tokens` 服务端生成 + SHA-256 + RLS）
- 旧链路退场：裁定要求限期退场（已于 2026-09-04 经用户最终裁定取消，长期保留，BUG-12 备份+合并兜底继续有效）。
- 自定义 Schema 需要在 Supabase Data API 设置中显式 Expose，且 grants 和 RLS 同时配置；这是一项用户 Dashboard 操作。

**验收标准**：

- 独立 `prompt_manager` Schema、Migration、RLS、Realtime publication 和数据库目录均可追溯；未触及其他工具 Schema。
- 浏览器只使用 publishable key；所有查询、写入和 Realtime 仅返回当前 `auth.uid()` 的数据。
- 无整库快照覆盖；同一记录并发编辑得到明确冲突，不同记录并发编辑不互相丢失。
- Mac 与 PC 的 INSERT/UPDATE/DELETE、标签关系和复制计数均双向同步；断线重连后重新拉取。
- 本地迁移结果、RLS 越权、备份与恢复演练均通过；`aiApiKey` 不出现在数据库、导出、日志或 Git。

0. **P0级用户反馈问题整改**（2026-08-28 用户反馈，最高优先级 — 全部完成）：
   - P0-D 标签切换逻辑修复：单击标签切换筛选，再次单击取消筛选 ✅
   - P0-E 标签拖拽功能实现：拖拽排序、设为子标签、合并标签 ✅
   - P0-F 右侧预览面板排版优化：标题突出、调取码收进标题行、移除'添加标签'说明 ✅
   - P0-G MCP连接说明文档：在设置中新增MCP连接说明 ✅
   - P0-H MCP连接一键复制提示词：设置中改为三场景（GPT/WorkBuddy/Orca）一键复制提示词，含构建命令与完整 AI 代理可执行提示词 ✅
   - P0-I 正文区域格式整理功能：设置中自动整理开关+左/中/右对齐，预览面板手动「✦ 格式整理」按钮，粘贴时自动触发 AI 整理（默认关）、手动整理建版本、自动不建版本 ✅（QA验收通过）

1. **P0-B 标签合并与批量移除**（2026-08-28 智能体审查建议，最高优先级 — 已完成）：
   - "合并到…"：迁移源标签关系到目标标签、自动去重、删除源标签、绝不删除 Prompt ✅
   - 重命名遇同级同名时提供"取消 / 改名 / 合并到现有标签" ✅
   - 批量操作栏增加"移除标签"，仅解除所选 Prompt 的关系，不删全局标签 ✅
   - 解除标签上限 3 个（改为 10 个），对旧数据、创建、编辑、批量操作统一处理 ✅

2. **P0-C 可组合的标签筛选**（2026-08-28 智能体审查建议，最高优先级 — 已完成）：
   - 从"单选标签"升级为筛选条件组：包含任一（OR）、必须同时包含（AND）、排除（NOT）✅
   - "包含子标签"开关 + 与已有全文搜索/@调取码搜索叠加 ✅

3. **P0-A 高影响标签操作的「安全闭环」**：已交付（见「已收口」QA/产品验收 PASS）。

4. **P0-8 标签重命名**：已交付，见「已收口」。

5. **P0 标签系统 22 项核心能力**：已交付，见「已收口」。

## 验收标准（P0级用户反馈问题整改 — 已通过 QA 验收 2026-08-28）

- P0-D 标签切换逻辑修复：单击标签切换筛选，再次单击取消筛选，功能正常 ✅
- P0-E 标签拖拽功能实现：拖拽功能已实现，有操作提示「拖到上/下边缘排序，拖到标签上可设为子标签或合并」✅
- P0-F 右侧预览面板排版优化：标题突出（文本栏形式），调取码收进标题行（@符号 + 调取码输入框），布局合理 ✅
- P0-G MCP连接说明文档：设置中新增MCP连接说明区域，包含配置示例、安装说明、使用说明 ✅
- P0-H MCP连接一键复制提示词：设置中展示 GPT/WorkBuddy/Orca 三场景，各含构建命令与完整 AI 代理可执行提示词，6 个复制按钮真机逐一点击通过 ✅
- 真机验证：Orca Computer Use 操作 localhost:3000，截图存 scratch/qa-real-device/ ✅
- `npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告 ✅

## 验收标准（P0-A — 已通过 QA/产品验收 2026-08-28）

- 删除前显示真实影响数：删除确认展示关联 Prompt 数（含子标签去重）与子标签（名/数），提示词本身不删除 ✅
- 标签级操作（创建/重命名/移动/删除）Toast 内 10s「撤销」，撤销后 Tag 实体、promptTags 关联、卡片冗余 tags 显示全部恢复（真机验证：vpn 删除→撤销后 `vpn 1`、关联 1、卡片 tags=['vpn'] 复原） ✅
- 服务端写入前校验拒绝非法数据：父级不存在 / 层级成环 / 同父重名 / 关联悬空 / (prompt_id, tag_id) 重复 / 标签 id 重复 → 均返回 `数据校验失败` 且不落盘（curl 七项逐条验证） ✅
- 带版本号提交：`baseVersion` 与当前版本不一致 → 返回 `版本已变化…请刷新后重试`（conflict）且不落盘；一致则正常写入版本 +1；内容无变化保持版本号 ✅
- `npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告；`npm run build` 通过 ✅
- 既有能力不破坏：标签树/筛选/CRUD/实时同步/撤销栈/批量管理回归通过；数据完整性 32 卡 / 12 标签 / 53 关联 / 0 悬空 / 0 重复 ✅

## 实施方案（P0-A）

### 数据层
- `src/lib/tags.ts`：新增 `validateTagGraph(tags, promptTags, cardIds)` 纯函数，五项完整性校验同源复用（客户端守卫 + 服务端纵深防御）
- `src/lib/serverStore.ts`：`setState` 增加 `baseVersion` 可选参数与校验；新增 `SetStateResult = number | {ok:false, error, conflict?}`；落盘前 `validateTagGraph` 校验，非法/冲突拒绝并返回错误对象（route 透传）

### 接口层
- `src/app/api/sync/route.ts`：**必要偏差**——透传 body 的 `baseVersion` 给 `setState`（版本号提交若不透传则无法实现，见下「偏差说明」）

### 同步层（storage.ts）
- `knownVersion` 追踪（loadFromServer / pushToServer 成功后同步）
- `pushToServer` 携带 `baseVersion`，返回 `'ok' | 'conflict' | 'error'`
- `doPush` 冲突处理：拒绝 → `loadFromServer` 刷新权威数据（更新 knownVersion）→ 基于最新版本重试 → `onConflictRefresh` 通知页面重载视图 + 提示用户
- `sanitizePromptTags`：推送/加载时净化悬空（卡片/标签不存在）与重复关联，自愈旧数据、避免服务端校验误拒

### 交互层（page.tsx）
- `captureTagSnapshot` / `restoreTagSnapshot`：标签级操作（创建/重命名/移动/删除）前后三态快照，`notifyWithUndo` 10s 撤销整体回退
- 卡片删除/批量删除/清空仓库：删除卡片时同步清理其 promptTags 关联（关联不悬空 + 计数不再虚高）
- 载入示例 / 导入：按新卡片的字符串标签重建 tags/promptTags（关联不悬空），撤销一并回退
- 注册 `setConflictRefreshHandler`：版本冲突后重载服务端权威视图并 toast 提示

### 偏差说明（Builder 权限外必要改动，需记录）
- **`src/app/api/sync/route.ts` 已改动**：透传 `baseVersion` 给 `setState`。任务「带版本号提交；版本已变化则拒绝」必须在服务端读到客户端声明的基础版本，而该值只能经 route 从请求体透传；`setState` 拿不到即版本校验永不生效（已实测：不透传时冲突写入被静默接受）。改动仅 2 行（类型扩展 + baseVersion 透传），无行为变更面。请 Planner/Reviewer 知悉。
- **数据恢复事件（重要，需 QA 知悉）**：验证「版本冲突拒绝」时，首次测试因 route 未透传 `baseVersion`，冲突 payload 被当作正常写入落盘，将实时共享库 `data/store.json`（version 1017，32 卡 / 19 标签 / 56 关联）覆盖为空。已从 `data/store.json.bak-20260827-renamefix`（32 卡 / 12 标签 / 53 关联）恢复，并在修复 route 透传后重新验证冲突拒绝通过。**相对事故前的实时数据，损失 7 个标签与 3 条关联（renamefix 快照之后新增）**；卡片 32 张完整保留。如用户浏览器 localStorage 仍存旧数据（未在事故窗口被 SSE 覆盖的标签页），重连后会自动迁移回补。本次真机验证产生的所有临时改动（vpn 删除/撤销、p0a-undo-test 创建/删除、临时标签写入/回滚）均已清理，最终库 32 / 12 / 53 / 0 悬空 / 0 重复。

## 已收口（2026-08-28，P0级用户反馈问题整改 — QA验收 PASS）

- **P0-D 标签切换逻辑修复**：单击标签切换筛选，再次单击取消筛选，功能正常。真机验证：点击"编程"标签→显示"OR: 编程"，再次点击→筛选取消，恢复显示全部32张卡片。
- **P0-E 标签拖拽功能实现**：拖拽功能已实现，有操作提示「拖到上/下边缘排序，拖到标签上可设为子标签或合并」。真机验证：拖拽操作响应正常。
- **P0-F 右侧预览面板排版优化**：标题突出（文本栏形式），调取码收进标题行（@符号 + 调取码输入框），布局合理。真机验证：点击卡片后右侧预览面板显示正常。
- **P0-G MCP连接说明文档**：设置中新增MCP连接说明区域，包含配置示例、安装说明、使用说明。真机验证：点击"设置"按钮→展开"MCP连接说明"→内容完整。
- **P0-H MCP连接一键复制提示词**：设置中 MCP 连接说明改为三场景（GPT/WorkBuddy/Orca）一键复制提示词，每场景提供构建命令 + 完整 AI 代理可执行提示词（含环境检测、路径填充、配置写入、新开会话指令）。真机验证：6 个复制按钮逐一点击，剪贴板内容匹配且按钮反馈"已复制"。截图：`scratch/qa-real-device/p0-h-settings-mcp-expanded.png` 等 9 张。
- 涉及文件：`src/components/TagPanel.tsx`（P0-D/P0-E）、`src/components/PreviewPanel.tsx`（P0-F）、`src/components/SettingsModal.tsx`（P0-G/P0-H）。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告；真机 Orca Computer Use 操作 localhost:3000，截图存 scratch/qa-real-device/。

## 已收口（2026-08-28，P2-10/P2-11 网格直删+批量管理）

- **P2-10 网格直删入口（核验既有实现）**：`CardItem` 悬浮胶囊 `text-rust` 删除按钮（`onDelete` prop，`!readonly` 渲染，`stopPropagation`）+ `handleDeleteCard` 条件 `confirm`「确定删除「{title}」？此操作不可撤销。」+ `snapshot` + `notifyWithUndo` 10s 撤销 + demo 隐藏；`isDemoView ? undefined : handleDeleteCard`。
- **P2-11 批量管理（核验既有实现）**：`bulkIds` Set + `CardItem` checkbox（`role="checkbox" aria-checked`）+ 顶部批量操作栏「已选 N 张」+ 打标签（prompt→parseTags→addCardTag 去重≤3→syncCards）/ 打星（0-5 校验）/ 导出（buildMarkdownExport）/ 删除（confirm 含数 + 撤销）/ 取消选择（clearBulk）。
- 涉及文件：`src/components/CardItem.tsx`、`src/app/page.tsx:490-662`（handleDelete/handleBulk*）、`src/lib/storage.ts`/`types.ts`（confirmDelete）；核验无新增改动，12项 QA/产品验收 PASS。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告；API `/api/sync` 33→32。

## 已收口（2026-08-28，P1 产品缺陷 4 项打包）

- **P1-1 TagPanel 底部文案与同步架构一致**：`TagPanel.tsx` 底部文案改为在线「已开启局域网实时同步（服务端共享存储），离线时回退本机缓存」、离线（`offline` prop，`serverOnline===false`）「未连接同步服务，已使用本机本地数据」。验证原「数据仅存于本机」误导已消除，文案与 README/HANDOFF/CURRENT_STAGE 所述服务端共享存储 + localStorage 离线兜底 + SSE 实时同步一致。
- **P1-2 关闭/切卡不再静默丢稿**：CardDetail `handleClose`（Esc / 蒙层 / 关闭按钮）先 `clearTimeout(notesTimer)` + `commitSave(true)` 再 `onClose`；PreviewPanel 移动端抽屉「收起」新增 `handleClose` 同样先 flush；切换选中经 `key={previewCard?.id}` 重挂 + 卸载 effect flush 兜底；两组件卸载 effect 均 `clearTimeout(notesTimer)` + `saveThrough(true,true)`。杜绝光标仍在输入框时 Esc / 收起 / 切卡导致的修改丢失。
- **P1-3 导入选择器支持 .md**：`TopBar.tsx:70` `accept=".json,.md,application/json,text/markdown"`，按钮 `title`「导入备份（支持 JSON 与 Markdown）」——与 `parseImport`/`buildMarkdownExport` 导出 Markdown 闭环一致（本项代码已在库中，本次核验确认）。
- **P1-4 调取码冲突语义统一**：CardDetail 与 PreviewPanel 均为「跳过冲突 code 字段、其余字段照存」+ 冲突提示「该调取码已被其他卡片使用，请更换」+ 保存时 toast「调取码与其他卡片冲突，其余修改已保存，请更换调取码后重试」（两组件 saveThrough 逻辑一致，本项核验确认）。
- 涉及文件：`src/components/TagPanel.tsx`、`src/components/PreviewPanel.tsx`（本次修改）；`src/components/TopBar.tsx`、`src/components/CardDetail.tsx`（核验既有实现）。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告。

## 已收口（2026-08-27，P0 标签系统 22 项）

- 数据层（types/tags/serverStore/storage/api sync）+ 迁移脚本（dry-run → --apply → 校验）+ 树形 TagPanel + 核心交互（创建/多标签/搜索/补全/数量/筛选/父含子/加/移除/重命名/移动/删除/无标签/继承/重名/确认/外键安全/循环检测）全部就绪
- 涉及文件：`src/lib/tags.ts`（新增）、`scripts/migrate-tags.mjs`（新增）、`src/lib/types.ts`、`src/lib/cards.ts`、`src/lib/serverStore.ts`、`src/lib/storage.ts`、`src/app/api/sync/route.ts`、`src/app/page.tsx`、`src/components/TagPanel.tsx`、`src/components/CardDetail.tsx`、`src/components/PreviewPanel.tsx`
- 浏览器实测（agent-browser）：11 标签树渲染、点击「开发恢复」→ 11 张、点击「无标签」→ 2 张（迁移预期）、删除「预览服务」→ 标签 11→10、卡片 32→32 安全约束通过
- 迁移报告：`tags=11 / promptTags=55 / 0 孤儿`，备份 `data/store.json.bak-20260827-133433`

## 已收口（2026-08-28，P0-A 高影响标签操作的「安全闭环」— QA/产品验收 PASS）

- **删除前真实影响数**：删除确认展示关联 Prompt 数（子树去重）与子标签；真机验证 vpn「当前有 1 条提示词使用此标签」。
- **10s 撤销**：创建/重命名/移动/删除四类标签级操作全部 `notifyWithUndo`，`captureTagSnapshot`/`restoreTagSnapshot` 三态快照回退；真机验证 vpn 删除→撤销后标签、关联（1）、卡片冗余 tags=['vpn'] 全部复原。
- **服务端写入前校验**：`tags.ts` 新增 `validateTagGraph`（父级存在/无环/同父无重名/关联不悬空/唯一/id 重复）；`serverStore.setState` 落盘前校验拒绝非法数据（curl 七项逐条验证）。
- **带版本号提交**：`storage.pushToServer` 携带 `baseVersion`；`setState` 版本已变化→conflict 拒绝不落盘；客户端刷新权威数据后重试 + `onConflictRefresh` 通知页面重载视图；route.ts 透传 baseVersion（必要偏差，见上方偏差说明）。
- **关联不悬空配套**：卡片删除/批量删除/清空/载入示例/导入同步清理或重建 promptTags；`sanitizePromptTags` 推送/加载净化悬空与重复。
- 涉及文件：`src/lib/tags.ts`、`src/lib/serverStore.ts`、`src/lib/storage.ts`、`src/app/api/sync/route.ts`（必要偏差）、`src/app/page.tsx`。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告；`npm run build` 通过；真机（Orca Computer Use）验证删除影响数/撤销恢复/服务端校验/版本冲突；最终库 32 卡 / 12 标签 / 53 关联 / 0 悬空 / 0 重复。QA 2026-08-28 4项 ALL PASS + 产品验收 4维度 PASS。

## 已收口（2026-08-28，P0-8 标签重命名）

- 选中标签 ⋯ 菜单「✎ 重命名」→ prompt 输入新名 → `handleRenameTag` 校验（空名 / 50 字 / 同父重名 `isNameUnique`）→ `renameTag` 仅改 `Tag.name` → `applyTags` 原子落盘（`syncCardsToPromptTags` 重建 Card.tags 冗余字段，方案 A 双写一致）。
- 涉及文件：`src/components/TagPanel.tsx`（既有入口，无需改动）、`src/app/page.tsx`（handleRenameTag 对齐 applyTags 原子落盘）、`src/lib/tags.ts`（既有 renameTag + tagPath 动态计算，无需改动）。
- 验证：`npx tsc --noEmit` 零错误；`npm run lint` 零错误零警告。
- 要点：稳定 tag_id 关联 → 仅改一条 Tag 记录即可完成全量关联更新（交接 §39）；父重命名子路径经 `tagPath` 动态计算自动变化（交接 §8）。

## 已收口（2026-08-28，P0-6 重开 + P0-7 两项打包）

- P0-6 修复 mark 类名根因 + 亮/暗高对比调优；P0-7 操作列悬浮胶囊化 + 正文 3 行
- 涉及文件：src/components/CardItem.tsx、src/app/globals.css、eslint.config.mjs
- 浏览器实测截图：scratch/p06-light-qa-v2.png（亮色 qa 高亮）、p06-dark-qa-final.png（暗色 qa 高亮）、scratch/p07-dark-grid.png（暗色默认网格，对比亮色同样布局紧凑）

## 已收口（2026-08-27，commit 2e7b635）

- 11 合 1（P0-6 高亮二次优化 + P2-6/P2-7/P3-4/P3-5 + P2-1/P2-5/P2-11 + P2-3/P2-4/P3-2）已交付并通过 QA / 产品 PASS。

## 新增P0级任务（2026-08-28 用户反馈）— 已完成

### P0-D 标签切换逻辑修复（用户截图反馈）
- **问题**：当前标签筛选为多选模式，需要点击两次才能切换标签
- **期望**：单点切换标签，便于用户查看不同标签下的内容
- **方案**：修改TagPanel组件的筛选逻辑，从多选模式改为单选切换模式
- **优先级**：P0（用户反馈最高）
- **状态**：✅ 已完成，QA验收通过

### P0-E 标签拖拽功能实现（用户截图反馈）
- **问题**：无法通过拖拽建立子文件夹或合并文件夹
- **期望**：参考FLomo，支持拖拽排序、合并、将一个标签变为另一个标签的子标签
- **方案**：实现标签拖拽排序、拖拽建立子标签关系、拖拽合并标签功能
- **优先级**：P0（用户反馈最高）
- **状态**：✅ 已完成，QA验收通过

### P0-F 右侧预览面板排版优化（用户截图反馈）
- **问题**：标题不够突出、"添加标签"文字说明多余、调取码占用空间太大、正文应占60%以上
- **期望**：优化标题显示、删除"添加标签"文字说明、优化调取码布局、调整模块顺序
- **方案**：优化标题显示、删除"添加标签"文字说明、优化调取码布局、调整模块顺序（标题→备注→标签→增加标签→正文）
- **优先级**：P0（用户反馈最高）
- **状态**：✅ 已完成，QA验收通过

### P0-G MCP连接说明文档（用户口头反馈）
- **问题**：没有MCP连接的说明文档或方式
- **期望**：增加MCP连接的说明文档或方式，让其他智能体更好地调用和连接
- **方案**：在设置中增加MCP连接说明，提供MCP连接方式和配置说明
- **优先级**：P0（用户反馈最高）
- **状态**：✅ 已完成，QA验收通过

### P0-H MCP连接一键复制提示词（用户口头反馈）
- **问题**：P0-G 已在设置中添加 MCP 连接说明，但当前只是展示原始 JSON 配置和命令行，用户仍需手动复制配置、手动编辑文件
- **期望**：直接复制一段完整的提示词/指令，发给 GPT/WorkBuddy/Orca，AI 代理能自动完成连接配置
- **方案**：将 SettingsModal 中 MCP 连接说明改为三个场景（GPT/WorkBuddy/Orca）的「一键复制提示词」，每个场景提供：1) 构建命令 2) 完整的 AI 代理可执行提示词（含环境检测、路径填充、配置写入、会话重开指令），附带复制按钮
- **优先级**：P0（用户反馈最高）
- **状态**：✅ 已完成，QA验收通过
