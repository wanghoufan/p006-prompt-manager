# HANDOFF｜交接（暂停/恢复用，先读我）

> 2026-09-28 更新（**本文件即现役入口，无编号节**）。旧交接全文备份为 `HANDOFF.md.旧版-2026-09-13`（1900+ 行），历史不断，断会话靠它接续。

- Captured at（YYYY-MM-DD HH:MM）：2026-09-28 15:10
- PROJECT_PHASE：DEVELOP（现状运行期；存储已切本地 SQLite，Mini 单设备 + 局域网多端浏览器访问）
- PLAN_VERSION：（无）
- PLAN_READINESS_SCORE：（无）
- PLAN_GATE：（N/A，非 PLAN 链）
- DEV_BASELINE：STATUS-QUO-2026-09-28（SQLite 迁移轮 6 次提交已上线，HEAD `d25d881`）
- CHANGE_REQUEST：NONE
- Stage ID（本阶段叫什么）：现状运行期（SQLite 本地化后）
- 剩 P0（没完的才列，多一条都不行）：无
- 当前 Task（正干到哪）：SQLite 迁移 + 审查 + 修复全部完成上线，无开发中 Task
- 执行链/Session：—
- 未闭环评审意见：CODE_REVIEW.md §四 3 个决策项已由用户拍板（回退保留/局域网现状/文档对齐），其余 P1/P2 见 §4.3 待择机处理
- docs 落盘清单：本文件（HANDOFF.md）、CODE_REVIEW.md §四、BUGS.md（BUG-16）、AGENTS.md（§一技术栈对齐 + §十一踩坑经验）
- 下一步（Next Single Action）：无强制下一步；候选见下方「待择机处理」
- 人要拍什么板：10 个非 `__` 前缀疑似测试标签去留（沿用未定）
- permission_request：无
- 收尾记一笔：2026-09-28 洁癖收尾完成（残留清理 + 文档对齐 + 治理文件入库）

## 本轮已上线改动（2026-09-28，SQLite 迁移轮）

| 提交 | 改动 | 备注 |
|---|---|---|
| `1ba17df` | 存储从 Supabase 切换为本地 SQLite（唯一主存储） | db/migrations 机制；DockerData bind mount |
| `900857b` | .gitignore 例外 + MCP .env.example 入仓 | |
| `ec2dada` | 治理收尾（HANDOFF 精简重写 + 角色表） | 旧版已备份 |
| `cbfd02b` | 全库审查报告落盘（无 P0；3 P1/5 P2/3 P3）+ 复审 | docs/review/CODE_REVIEW.md §四 |
| `b1bf1af` | 卡片重复修复（本地模式服务器覆盖 localStorage，240→120） | |
| `d25d881` | BUG-16：Composer 三开关持久化到 settings（migration 0002） | API 层验证 PASS；UI 待用户顺手复核 |

> 2026-09-27 轮 5 次提交（`7e6ff51`~`88f4d85`，含自定义确认弹窗替换 10 处 `window.confirm`、多选入口）均已上线，详情见 git log，此处不再重复。

## 待择机处理（非 P0，按需启动）

- CODE_REVIEW.md §4.3 三个 P1（backup-sqlite.sh 恢复需先停容器、导入脚本并发、局域网信任模型已裁定维持现状）——使用侧注意事项，非代码急修
- CODE_REVIEW.md §四 5 个 P2（全量覆写性能模型、revision 死字段、空 title 静默降级、MCP 版本号不一致等）
- 10 个非 `__` 前缀疑似测试标签去留待用户定

## 恢复读盘（全体系唯一顺序，别乱）

1. AGENTS；2. 角色卡；3. 根 `USER_MODEL_OVERRIDE.md`（现为软链，指母版真源）；4. 本 HANDOFF；5. 根 `经验一句话.md`；6. 任务目标放最后。
冲突才扩大读。
