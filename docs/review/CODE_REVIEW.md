# 代码审查报告 · 提示词管理工具

- **审查时间**：2026-08-15
- **审查范围**：`src/` 全部源码（lib / app / components）
- **审查性质**：首次审查（此前无历史审查文档）
- **静态检查**：`tsc --noEmit` 通过，`eslint src` 通过（0 error / 0 warning）
- **结论**：类型与风格层面无问题；问题集中在**运行行为 / SSR 水合 / 交互一致性**。

---

## 更新记录（2026-08-25）

随「跨设备同步 + UI 优化 + 调取码 + MCP 集成」改造，复核以下项状态：

| 编号 | 原状态 | 现状 |
|---|---|---|
| BUG-1 | 高 · 未修 | ✅ **已修复**：初始化改为空数组 + 挂载后异步加载（`page.tsx`），不再在 `useState` 初始化器读 localStorage |
| BUG-2 | 中 · 未修 | ✅ **已修复**：`detailCard` 改用 `sourceCards.find(...)`，示例卡片可只读打开详情 |
| BUG-3 | 低/中 · 未修 | ✅ **已修复**：复制仅成功分支计数，失败提示且不计数（`handleCopy`） |
| OPT-1 | AI 请求缺 AbortController | ⏳ 未修（本次未涉及） |
| OPT-2 | 模态框焦点陷阱 | ✅ **CardDetail 已修复**（`useModalFocus` + `role="dialog"` + `aria-modal`）；`SettingsModal` 未复核 |
| OPT-3 | 标题可能变空串 | ✅ **已修复**：`regenMeta` 用 `data.title?.trim() || card.title` 兜底 |
| OPT-4 | 模板 `{body}` 未校验 | ⏳ 未修 |
| OPT-5 | 弹窗打开时评分快捷键误触 | ⏳ 未修 |
| OPT-6 | 复制失败无感知 | ✅ **已修复**：失败 `notify('复制失败，请手动复制')` |

### 新增已知边界（2026-08-25 起）

- **MCP 计数并发**：`/api/sync/increment-copy` 由 `serverStore.incrementCopy` 原子 +1，但 MCP 读 `data/store.json` 与 serverStore 内存可能短暂不一致（低并发个人场景可接受）。
- **MCP 计数失败静默**：MCP 命中后 fire-and-forget 调计数 API，失败不阻塞取卡片（`copyCount` 可能少计，可接受）。
- **跨进程写冲突规避**：MCP 不直接写 `store.json`（否则会被 serverStore 内存覆盖），统一走 API。

---

## 一、Bug（按严重度排序）

### BUG-1 ·【高】localStorage 在 `useState` 初始化器中读取，导致 SSR 水合不匹配
- **位置**：`src/app/page.tsx:20-21`、`src/lib/storage.ts:38`
- **现象**：`Home` 组件是 `'use client'`，但在 App Router 下仍会在服务端预渲染。`useState(() => loadCards())` 的初始化器在服务端执行时 `localStorage` 不存在，被 `try/catch` 捕获返回 `[]`，因此服务端 HTML 渲染为「空仓库」界面；客户端水合时又用本地真实数据渲染出卡片列表。两者不一致会触发 React hydration mismatch 警告，并在用户已有数据时产生闪烁/重渲染。
- **修复建议**：初始化为空，客户端挂载后再读取：
  ```ts
  const [cards, setCards] = useState<Card[]>([])
  useEffect(() => { setCards(loadCards()) }, [])
  ```
  或使用 `mounted` 标志，避免首屏空态闪烁。

### BUG-2 ·【中】示例库声称覆盖「思维总结 / 版本回滚」，但示例卡片无法点开查看
- **位置**：`src/app/page.tsx:77`、`src/components/CardItem.tsx:20,29-45`、`src/app/page.tsx:255-263`
- **现象**：
  1. 示例视图下 `CardItem` 为只读：`onDoubleClick` 被置为 `undefined`，「编辑」按钮也不渲染，因此**详情弹窗在示例视图下完全不可达**，示例卡片自带的 `thinkingSummary` 与 `versions` 数据永远无法被用户看到。
  2. 顶部示例横幅写道「覆盖星级、复制统计、版本回滚与思维总结」，与「点不开任何示例卡片」的实际体验矛盾。
  3. 即使将来放开示例详情，`detailCard` 只用 `cards.find(...)`（用户仓库）检索，`sourceCards`（含 `DEMO_CARDS`）被忽略，示例卡片仍查不到（`page.tsx:77`）。
- **修复建议**：将 `detailCard` 改为 `sourceCards.find(...)`；并允许示例卡片以只读方式打开详情（弹窗已有 `readonly` 概念可复用），使横幅承诺的能力真实可见。

### BUG-3 ·【低/中】复制失败时复制计数仍 +1，且未校验剪贴板写入结果
- **位置**：`src/app/page.tsx:130-147`
- **现象**：`navigator.clipboard.writeText(...).catch(fallback).finally(increment)` 中 `.finally` 无论成功失败都执行，导致复制失败时 `copyCount` 仍自增；`document.execCommand('copy')` 的返回值也未被检查。计数不再是真实「复制次数」指标，会污染「按复制次数排序」的结果。
- **修复建议**：在 `.then` 成功分支内自增，或检查 `execCommand` 返回值，失败时 `notify('复制失败')` 且不计数。

---

## 二、优化建议

### OPT-1 · AI 请求缺少 AbortController，组件卸载后仍可能 setState
- **位置**：`src/components/Composer.tsx:23-42`、`src/components/CardDetail.tsx:58-95`
- **说明**：生成标签/标题、思维总结的请求未在组件卸载或重复提交时取消。虽然 React 19 已不再对卸载后 setState 报警，但属于不规范用法；连续点击「重试 / 重新生成」会并发多个请求，最后一个返回覆盖前者。
- **建议**：使用 `AbortController` 并在 `useEffect`/`finally` 中 `abort()`，或在请求进行中禁用按钮（当前 `metaLoading` 仅作用于详情页，Composer 未禁用「生成卡片」）。

### OPT-2 · 模态框无障碍：缺少焦点陷阱与 `aria-modal`
- **位置**：`src/components/CardDetail.tsx:104`、`src/components/SettingsModal.tsx:25`
- **说明**：弹窗仅用 `Escape` 关闭，未做焦点陷阱（`focus trap`）、未设 `role="dialog"` / `aria-modal="true"`，关闭后焦点未归还触发元素。键盘用户可在弹窗打开时 `Tab` 到背景元素。
- **建议**：增加 `role="dialog"`、`aria-modal`，并在打开时聚焦首个可聚焦元素、关闭时归还焦点。

### OPT-3 · 重新生成标签时标题可能变为空串
- **位置**：`src/components/CardDetail.tsx:68`
- **说明**：`regenMeta` 直接 `onUpdateMeta(card.id, data.title ?? '', ...)`。若 AI 未返回 `title`，标题被写成空串；而创建卡片时 `createCard` 有 `title || '未命名提示词'` 兜底，两者行为不一致。
- **建议**：与创建逻辑保持一致，标题为空时回退 `card.title` 或「未命名提示词」。

### OPT-4 · 自定义思维总结模板未校验 `{body}` 占位符
- **位置**：`src/components/SettingsModal.tsx:43-52`、`src/lib/ai.ts:118-122`
- **说明**：设置页提示「`{body}` 会被替换」，但若用户模板中漏写 `{body}`，`template.replace('{body}', body)` 不会注入正文，请求会发出一个没有正文的模板，行为静默异常。
- **建议**：保存时检测模板是否包含 `{body}`，缺失则提示或自动追加，避免无效调用。

### OPT-5 · 全局数字评分快捷键在弹窗打开时仍生效
- **位置**：`src/app/page.tsx:210-226`
- **说明**：页面级 `keydown` 监听对输入框/文本域做了过滤，但当详情弹窗打开、焦点落在某个按钮上时，按 `1~5` 仍会对背景卡片评分（例如点了「复制次数清零」后再按 `5`）。
- **建议**：弹窗打开期间（`detailId`/`showSettings` 为真）不触发该评分快捷键，或把评分快捷键收敛到详情弹窗内。

### OPT-6 · 复制失败时用户无感知
- **位置**：`src/app/page.tsx:130-147`（关联 BUG-3）
- **说明**：剪贴板写入失败时既没有提示也没有正确计数，用户以为已复制成功。
- **建议**：失败时 `notify('复制失败，请手动复制')`，配合 BUG-3 的计数修正。

---

## 三、已确认无问题的点

- `LayoutProps<"/">`（`src/app/layout.tsx:9`）：Next.js 16 的全局布局类型辅助，**合法**，非 bug。
- 版本快照 `withVersion`：`[...card.versions, version].slice(-MAX_VERSIONS)` 正确限制为 10 条，且全程生成新数组，不会污染 `DEMO_CARDS`（`src/lib/cards.ts:22-30`）。
- 导入/解析 `parseImport`：对结构与字段类型有完整校验，安全（`src/lib/storage.ts:87`）。
- `extractJsonCandidates`：能正确剥离 ```json 围栏并提取首个顶层对象/数组（`src/lib/ai.ts:55`）。
- 标签去重与长度截断：`generateMeta` 与 `parseTags` 均做了 `slice`/`Set` 处理，符合「1~3 个、每标签 ≤4 字」约束。

---

## 四、修复优先级建议

1. **BUG-1（高）**：水合不匹配，影响所有已存数据用户的首屏体验，应最先修。
2. **BUG-2（中）**：示例库的演示价值与文案承诺不符，影响产品可信度。
3. **BUG-3（低/中）**：数据准确性，可随 OPT-6 一并处理。
4. 其余 OPT 为体验/健壮性增强，可排入后续迭代。
