---
name: token-efficient-read
description: 当任何角色需要读取文档或代码且必须避免大量 Token 消耗时使用；强制优先读取 CURRENT_STAGE + HANDOFF，通过标题定位区间分段读取，不做全仓扫描，单次输出不超过 4000 Token，跳过已 CLOSED 事项。
---

# 高效读取 — 定点读取（中文）

> 适用：所有角色（Builder、QA、Product、neat-freak、Stage Manager）读取项目文档或代码时。

## 规则（2026-08-28 用户确认）

1. 优先读取 `docs/progress/CURRENT_STAGE.md` + `docs/handoff/HANDOFF.md`（最新阶段 + 交接）。
2. 大型文档（`PLAN.md`、`PRODUCT_BACKLOG.md`、`CODE_REVIEW.md`）先用 `grep -n "^## "` 定位标题，再用 `read` 的 `limit/offset` 按区间读取。
3. 禁止用常见关键词全量搜索历史文档。
4. 单次工具输出不超过 4000 Token；超出则缩小范围或用 `bash rg` 限行。
5. 已移入“已完成”的 CLOSED 事项不再重新调查，仅读取结论。

## 提示词片段

```
约束：只做定点读取 — 优先 CURRENT_STAGE 的“<Stage>”小节 + PRODUCT_BACKLOG 的 <P-ID> 标题段；大型文档先定位标题再读区间，不扫全仓；不搜全历史；单次 ≤4000 Token；已 CLOSED 只读结论不重查
```

## Builder 大规模搜索/重构例外（2026-08-28 补充，仅 Builder）

- Builder 执行 **S 级大规模 UI 重构 / 全仓重命名 / 跨模块搜索** 时，可按需扩大定点范围（如全量读取 `src/components/*`、`src/app/*` 相关区间），单次可突破 4000 Token 限制，但仍需：① 跳过已 CLOSED 历史段落 ② 按标题区间分段读取而非一次性全量 `cat` ③ 优先读 `CURRENT_STAGE` + `HANDOFF` 再扩散
- 其他角色（QA、Product、neat-freak、Stage Manager）不适用此例外，仍按上条 1-5 严格执行

## 违规示例

- 为“了解项目”一次性读取全部文档
- 用宽泛关键词 `grep` 全仓扫描 `docs/` 且无标题过滤
- 对已 CLOSED 事项重复全量读取验证
