# 当前阶段

## 最新状态
- **时间**：2026-09-10
- **阶段**：现状运行期。Supabase 云端多端同步已完成 ✅（审核裁定 APPROVED_FOR_EXECUTION 2026-09-03 15:00；BUG-13 `tags.revision` 修复 2026-09-04 发布）；剩余待办已于 2026-09-04 经用户最终裁定全部取消。**2026-09-10 完成 AI 服务商从 8 厂商收敛为 3 家服务商 / 4 个选项，已上线生产**
- **分支**：`master`（最新 `1b569a5` 已推至 `origin/master`）
- **提交**：`1b569a5`（AI 服务商收敛 + D2 401 分类修复 + BUG-8 env Key 同源回退 + dev 回环水合，2026-09-10 已部署）
- **云端**：`yacgnikzvutbpoqvokth` / `prompt_manager` Schema（6 表×4 RLS，Remote 7/7 含 BUG-13 修复 + habit_tracker 统一）；Realtime 5 表；`activate_prompt` SECURITY DEFINER 已裁定接受。⚠️ **卡数为文档最后记录 54 张（2026-09-04），本轮未复核**；生产 `legacy-store/store.json` 本轮实测为 74 张（不同数据层，勿混用）
- **运行**：`prompt-manager-prompt-manager-1` Up 0.0.0.0:3100（`http://192.168.31.60:3100`，部署副本 `~/Developer/coding/docker/prompt-manager/` + `bash scripts/deploy.sh`）；2026-09-10 镜像 `328a58fe4ec2`、HTTP 200。**本地 dev server 已停用**（3199 已释放），预览统一走生产地址
- **AI 服务商（2026-09-10 收敛）**：`deepseek`（`deepseek-v4-flash`）/ `openrouter`（模型用户自填）/ `opencode`（Zen，`glm-5.3-flash`，⚠️ 账户无余额暂不可用）/ `opencode-go`（`deepseek-v4-flash` + `glm-5.3-flash`）。清单唯一来源 = `src/lib/ai/types.ts` 的 `AI_PROVIDERS`，须与 `SettingsModal.tsx`、`factory.ts` 三处同源
- **收口材料**：`docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`（2026-09-03 修订版，L0–L5 全部 ✅ / L5 审核已放行，已回填 §9/§10，7/7 已发布含 BUG-13）
- **平台仓库**：`/Users/zzymima0000/Developer/coding/1.Active/alw丨数据库管理专家/平台丨共享 Supabase 数据库` HEAD `2e92f08`（Remote 7/7 已发布，含 `20260904102000` BUG-13），已 `supabase link` 且管理员隔离重放零错误；已由唯一发布人 `db push --include-all` 登记

## 已完成（2026-08-28 前 P0/P2 批次 — 历史基线，仍 CLOSED）
| 任务 | 状态 | 验证 |
|------|------|------|
| P0-A 安全闭环 | ✅ CLOSED | QA/产品 PASS |
| P0-B 标签合并与批量移除 | ✅ CLOSED | QA/产品 PASS |
| P0-C 可组合标签筛选 | ✅ CLOSED | QA/产品 PASS |
| P0-8 标签体系完善 | ✅ CLOSED | PASS |
| P0-9 标签添加交互重构 | ✅ CLOSED | PASS |
| P0-D 标签切换逻辑修复 | ✅ CLOSED | QA/产品 PASS |
| P0-E 标签拖拽功能实现 | ✅ CLOSED | QA/产品 PASS |
| P0-F 右侧预览面板排版优化 | ✅ CLOSED | QA/产品 PASS |
| P0-G MCP连接说明文档 | ✅ CLOSED | QA/产品 PASS |
| P0-H MCP连接一键复制提示词 | ✅ CLOSED | QA/产品 PASS |
| P0-I 正文区域格式整理功能 | ✅ CLOSED | QA/产品 PASS |
| P2-1 正文失焦不建版本 | ✅ CLOSED | QA/产品 PASS |
| P2-3 移动端底部抽屉 | ✅ CLOSED | QA/产品 PASS |
| P2-4 备注防抖定时器清理 | ✅ CLOSED | QA/产品 PASS |
| P2-5 危险操作撤销 | ✅ CLOSED | QA/产品 PASS |
| P2-6 弹窗内评分守卫 | ✅ CLOSED | QA/产品 PASS |
| P2-7 空/离线态文案区分 | ✅ CLOSED | QA/产品 PASS |
| CardDetail格式整理入口 | ✅ CLOSED | QA/产品 PASS |

## 已完成（2026-09-01 ~ 09-03 Supabase 云端多端同步 — 本阶段核心）
| 事项 | 状态 | 记录 |
|---|---|---|
| 独立 `prompt_manager` Schema（6 表 + RLS 24 策略 + Realtime 5 表 + `activate_prompt`/`set_row_metadata`） | ✅ | 平台仓库 7/7 已发布（`20260901152616`/`20260901152750`/`20260901163555`/`20260903141849`/`20260903160500`/`20260903235600`/`20260904102000` BUG-13，Remote 7/7） |
| Supabase Auth（Magic Link + Google OAuth PKCE） | ✅ | Air、Mini 真机登录成功；Site URL 已修正为 `http://192.168.31.60:3100` |
| 记录级 `revision` 写入 + Realtime 跨端同步 | ✅ | BUG-11 四项修复（connect 代次序列化/登录态锁定+重试态/null-throw区分/auth去抖）部署并复测 0–4 全过 |
| BUG-9/10/11 修复闭环 | ✅ FIXED | `api/mcp-access-tokens` 服务端生成 + 选区复制兜底 + connect 修复，Air+Mini 双端复测 |
| 并发冲突验收 | ✅ 通过 | Mini toast 明确冲突、不覆盖，Air 胜出收敛（rev 8→39） |
| MCP 双设备隔离 | ✅ 通过 | Air 旧版 server 根因修复 → 独立令牌 + 撤销负向验证（Air 被拒/Mini 仍通） |
| 备份与隔离恢复演练 | ✅ 全绿 | 52 卡首演 + 55 卡复演（`DockerBackups/prompt-manager/`，生产零写入，6×4 RLS、零孤儿、码唯一） |
| Docker 自托管 | ✅ 运行中 | `prompt-manager-prompt-manager-1` 0.0.0.0:3100，legacy-store bind mount |
| 收口材料最终版 | ✅ 已修订 | `docs/review/共享Supabase数据库接入收口材料-2026-09-02.md`（2026-09-03，L0–L5 ✅） |
| 审核裁定 | ✅ APPROVED_FOR_EXECUTION | 2026-09-03 15:00 独立核验 + 5 项裁定，见审查裁定与转送清单 |
| 平台仓库基线 | ✅ 2e92f08 | 已 commit + 已 link + 隔离重放零错误 + `20260904102000` BUG-13 已发布（Remote 7/7） |

## 待办（2026-09-04 用户最终裁定：全部取消）
> 2026-09-04 11:38 用户最终裁定：P2 legacy 退场 / P3 连字符 / 掉登录监控 / 契约卡推广 等剩余待办全部取消，不做。项目进入现状运行期，仅日常使用与被动故障响应。
| # | 优先级 | 事项 | 状态 |
|---|---|---|---|
| 6 | — | `20260901163555` + `20260904102000` BUG-13 发布 | ✅ 已发布（Remote 7/7，含 BUG-13 修复） |
| 2 | P1 | 收口材料回填「15:00 后状态更新」 | ✅ 已回填（§9/§10，含 BUG-13） |
| 1 | P1 | 写队列停摆修复（PM-3） | ✅ 已部署（`503cf86` + `b7ce6ee`，30s 超时自愈；冲突回归按用户决定搁置） |
| 3 | P2 | legacy `/api/sync` 退场申请 | ❌ 已取消（2026-09-04 最终裁定，草稿留档不推进，BUG-12 备份+合并兜底继续有效） |
| 4 | P2 | 平台仓库 remote/备份 | ✅ 已完成（治理侧私有远端已同步 7/7） |
| 5 | P3 | 连字符调取码规则 | ❌ 已取消（2026-09-04 最终裁定） |
| — | — | git 分叉整合 / 洁癖收尾 | ✅ 已完成（master 已整合，361f776 已推；本次对齐待提交） |
| — | — | BUG-13 `tags.revision` 修复 | ✅ 已上线（2026-09-04 11:03，`20260904102000`，7/7，UI 已确认） |

## 下一步
1. 现状运行期：Mini 单设备日常使用，保存后刷新确认、定期导出（`http://192.168.31.60:3100`）。
2. **待推送收尾**（需用户口令「现在推送」）：`.gitignore`(M) + `docs/review/` 8 份归档(A)；纯文档 + 忽略规则，**不触发部署**。
3. **处置 OpenCode Zen 条目**（用户二选一）：充值后 `glm-5.3-flash` 恢复可用；或删除该 provider（需 `types.ts` / `SettingsModal.tsx` / `factory.ts` 三处同步 + 文档 + 一轮上线）。
4. 被动故障响应：仅当再现标签保存报错 / 掉登录等异常时，按 `HANDOFF §16.22 §3` 抓完整报错原文回报管理员。
5. 任何新数据库结构 / 权限动作需重新报审（改 `prompt_manager` 需出 Migration 草案 + 隔离复现 + 审批）。

> 权威交接见 `docs/handoff/HANDOFF.md` §16.22（当前唯一有效入口）；本文件仅作阶段快照。
