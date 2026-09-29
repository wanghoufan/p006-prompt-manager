# Skill 沉淀候选清单（待用户审查）

> **来源**：2026-09-27 ~ 09-29 本阶段开发。
> **筛选标准**：①用户反复提醒/明确立过规矩的；②我重复踩坑、耗了多轮才搞对的；③重复执行的固定流程。
> **每条含**：触发场景 → 正确做法 → 判据/命令。
> **审查方式**：逐条勾选「采纳 / 改写后采纳 / 不要」，确认后我再决定是否升级为正式 Skill。

---

## S-01｜后台无头测试，绝不抢用户前台 ⭐⭐⭐

**触发**：任何真机/浏览器测试。

**用户原话**（2026-09-17 / 09-21 立规，我今日违反了两次）：
> 「别抢占我电脑屏幕和鼠标」「不能通过 MCP 来进行后台的这个测试么」「使用 computer use 进行真机验证 这个通过后台 mcp 方式」

**正确做法**：
- 一律 `chromium.launch({ headless: true })`。
- **禁止** `open -a`、禁止 `osascript` 激活窗口、禁止任何可见窗口。用户在用电脑。
- Playwright 不装进项目：复用 `1.Active/028-ing-酒吧聚会社交导演/node_modules/playwright`，临时软链到 `node_modules/`，**测完删除软链**。

**判据**：`lsof -i :3101` 测试后为 0；测试期间无 `open` 调用。

**为什么值得沉淀**：这是用户唯一明确发过火两次的事，性质是「打扰他工作」。

---

## S-02｜隔离实例必须放行 `/api/sync` ⭐⭐⭐

**触发**：起隔离测试实例测任何写操作。

**今日代价**：我与 QA 各踩一次，导致「标签删除/合并没生效」被误报成 3 个 P1，白派一轮 code-reviewer 专项审查。

**原理**：隔离实例的持久化**正是靠 `POST /api/sync` 写隔离库**。为「防云端污染」把 `/api/sync` 一并 abort → UI 改了内存、提交被吞、库里没变、刷新即消失 → **看起来像功能坏了，其实是我的测试方法坏了**。

**正确做法**：
```js
await ctx.route('**/*', r => {
  if (/supabase\.co|\/rest\/v1\/|\/auth\/v1\//.test(r.url())) return r.abort()  // 只拦云端
  if (/192\.168\.31\.60:3100/.test(r.url())) return r.abort()                   // 绝不碰生产
  return r.continue()          // /api/sync 必须放行
})
```

**隔离实例正确启动方式**（本项目 `output: standalone`，`next start` 不可用）：
```bash
npx next build
cp -r .next/static .next/standalone/.next/
PORT=3101 SQLITE_DB_PATH=<仓内 scratch 绝对路径> \
  NEXT_PUBLIC_SUPABASE_URL="" NEXT_PUBLIC_SUPABASE_ANON_KEY="" \
  node .next/standalone/server.js
```

**连带坑**：
- 起服务前先 `lsof -ti :3101 | xargs kill` 清残留，否则 `EADDRINUSE`，报错停在 `listen`、看起来像库问题。
- 建表由**首次访问页面**触发 → 必须先 `goto` 再写种子数据，否则 `no such table`。
- 版本列是 `meta(key, value)`，查法：`SELECT value FROM meta WHERE key='version'`（**不是** `meta.version`）。
- 断言持久化前等 `version` 连续 1.2s 不变（乐观更新 + 延迟落盘，立即查会读到旧值 → 假 FAIL）。

---

## S-03｜零污染校验：先认对对象，再用内容级 ⭐⭐⭐

**触发**：任何「我没弄坏你的数据」的声明。

**今日代价**：我连续多轮验错对象 + 用错方法，QA 报「db 哈希不一致」才暴露。

**两个错**：
1. **对象错**：2026-09-28 迁 SQLite 后主存储是 `~/DockerData/prompt-manager/legacy-store/prompt-manager.db`；`store.json` 是 legacy 回退路径（mtime 停在 09-27）。我一直验它 = **假阴性安全**。
2. **方法错**：对**活库**用字节级 `shasum -a 256` 判「数据有没有被改」不成立 —— 应用正常写入（用户自己建一张卡）就变字节。

**正确口径**：
```sql
-- 生产库只读查询
SELECT COUNT(*) FROM cards;  SELECT COUNT(*) FROM tags;  SELECT COUNT(*) FROM prompt_tags;
SELECT COUNT(*) FROM cards WHERE title LIKE '\_\_QA%' ESCAPE '\';   -- 必须 0
```

**⚠️ SQL 陷阱**：SQLite 里 `__` 是**单字符通配符、不是下划线**。`LIKE '__QA%'` 会匹配到「**生成**QA测试提示词」等用户真实卡片 → 误报污染。凡匹配字面下划线必须 `ESCAPE '\'`。

---

## S-04｜小控件按「可点击热区」验收，不按字形尺寸 ⭐⭐⭐

**触发**：任何图标/文字类小控件（星星、复选框、图标按钮）。

**今日案例**：用户点五颗星打 5 星「点了不管用」。

**两层坑**（都是我自己修完第一层才发现第二层）：
1. **热区太小**：单颗星 14×14px，手抖偏 5px 就落空且零反馈 → 修法 `px-1.5 py-1 -mx-1.5 -my-1`（负 margin 抵消，视觉零变化）。
2. **热区扩大必然引入相邻重叠**：26px > 星间距 16px → 重叠 10px。桌面靠 `hover:z-10` 仲裁正确，**但触屏没有 hover** → `elementFromPoint` 按 paint order 命中后一颗 → **点 3 星打成 4 星（打错分，比热区小更严重）**。
   - 两者**不可兼得**（gap 不许动＝视觉；热区不许缩＝回归），只能改命中判定：根容器 `onClickCapture` 事件委托，按 `clientX` 与各颗星**字形中心**取最近者。
   - 抬层用 `hover:z-10` 必须配 **`focus-visible:z-10`**，用 `focus:z-10` 会让「鼠标点过的那颗」永久 z-index 10 压住后续 hover 判定。

**验收动作**：
- 量 `getBoundingClientRect()` 宽高 ≥ 22px。
- **专门测「偏 5px」**是否仍命中。
- 测相邻重叠带归属，且**必须分 `hasTouch: true` 与桌面两种 context**。
- 断言「视觉零变化」：量容器 `offsetWidth`、`gap`、字形位置未挪。

---

## S-05｜本地配置读不回来：查 SSR 水合，别只查逻辑 ⭐⭐

**触发**：用户说「我设过的东西刷新就没了」「宽度/展开状态/偏好不记住」。

**根因模式**：`useState(() => readFromLocalStorage())` 在 SSR 组件里**永远读不回来** —— 服务端 `typeof window === 'undefined'` 恒返回默认值，**客户端水合时 React 不重跑 initializer**。表现是「写盘成功、读取失效」，`localStorage` 里值明明在。

**正确修法**：首屏固定默认值（保证水合一致、零告警）+ 挂载后 `useEffect` + `useRef` 防重入同步一次；读到的值走**与写盘相同**的清洗函数。

**⚠️ 不可照搬的场景**：`page.tsx` 的 `readTrash()` 同源，但**不能**改 initializer 为 `[]` —— 回收站有「变更即写盘」effect 且 mount 就跑，会**先用空数组覆盖真实数据**（先毁后读）。需要 skip-first-write 守卫。

**顺带体检**：默认值落在 `[MIN, MAX]` 之外也是坑（`PANEL_DEFAULT_W=240 < PANEL_MIN_W=280` → 双击重置写 240、刷新被 clamp 成 280 → 莫名变宽）。

---

## S-06｜唯一索引 + 全量覆写 = 静默丢数据（P0 级） ⭐⭐⭐

**触发**：任何「DELETE 全部再逐条重插」的覆写事务 + 表上有**表达式唯一索引**。

**今日案例**（P0，用户数据可能全部静默丢失）：
```ts
db.exec('UPDATE tags SET parent_id = NULL')  // 绕 ON DELETE RESTRICT
db.exec('DELETE FROM tags')
// 索引：UNIQUE (COALESCE(parent_id,''), lower(trim(name)))
// 父级全清空 → 两个同名标签索引键相同 → 自撞 → 事务回滚
// → version 永不推进 → 此后每次保存失败
```
**放大器**：`doPush` 只处理 `conflict`，对 `error` 无分支 → 用户看到成功、实际一个字节没存、**零报错**。

**三条通用检查**：
1. 覆写事务里有没有「先归一化再删」的操作？有则必查表达式唯一索引。
2. 写入失败路径有没有用户可见反馈？`try/finally` 无 `catch` ＝静默吞错。
3. 修法：按**深度从深到浅**逐条 DELETE（满足 RESTRICT）+ 按**深度从浅到深**重插（不依赖客户端数组顺序）。**不改已发布的 migration**，在应用层解决。

**通用教训**：任何「服务端拒绝」和「网络失败」都必须有用户可见反馈 —— 静默失败比报错严重得多。

---

## S-07｜事件委托判定命中，不靠 z-index ⭐⭐

**触发**：一排密集小控件的点击归属；任何无 hover 的设备（触屏）。

**通用做法**：在容器上加 `onClickCapture`，用点击坐标与各控件**中心**的距离取最近者，不信 `e.target`、不信 paint order。配 `stopPropagation` 防双触发；键盘激活（`e.detail === 0`）走控件自身逻辑。

**判据**：测「相邻控件重叠带」在**无 hover context**（`hasTouch: true`）下的归属。

---

## S-08｜派通道角色前先查目录权限 ⭐⭐⭐

**触发**：派 opencode 通道角色（neat-freak / experience-recorder 等）做需要读**仓外**路径的任务。

**今日代价**：neat-freak 想读 `~/Developer/coding/docker/` 被 `external_directory` 自动拒，**整轮任务中断白烧额度**。

**正确做法**：
- 派工前问自己：这个角色需要读仓外吗？
- 需要 → **我自己先把仓外信息查好写进任务书**，禁止它出仓；或先取得用户授权。
- 任务书里写死：「**禁止访问本仓以外任何路径**」。
- 备选：把工作目录设到两仓共同父目录。

---

## S-09｜AC 补证必须拆批（4~5 条） ⭐⭐

**触发**：产品验收矩阵（20+ 条）一次性派 QA。

**今日实测数据**：
| 批次 | 范围 | tokens | PASS |
|---|---|---|---|
| 第 1 批 | 20 条 | 154k | 0 |
| 第 2 批 | 5 条 | 190k | 0 |
| 第 3 批 | 5 条 | 265k | 0 |
| 第 4 批 | 5 条 | 415k | 2 |

**关键认知**：拆批后 token 反而涨、产出反而跌 → 瓶颈不是拆批，而是①被原生弹窗阻塞 ②拖拽缺可靠操作指引 ③每批都要重建环境+build。

**真 bug 是怎么被找到的**（对照）：
- ✅ 面板宽度失效（`cbf0c73`）：**用户真机使用**发现 → QA 单点深测定位。
- ✅ 静默丢数据（`16a604b`）：QA 报了疑似 P1 → code-reviewer 静态确证。
- ❌ 4 批共 35 条 AC 补证：产出 2 个 PASS，其余全是 DEGRADED/未测。

**建议**：AC 补证降级为兜底手段；**优先「用户真机反馈 → 单点深测」和「code-reviewer 静态审查」**。

---

## S-10｜`next start` 对本项目无效 + 部署 PATH 缺凭据 ⭐⭐

**本项目两个反复踩的环境坑**：

1. **隔离实例**：`output: standalone` → `next start` 不работает（报 `does not work with "output: standalone"`），且**不报错但服务其实没起**，表现为「页面 200 但库是空的」。正确：`node .next/standalone/server.js` + 先拷 `.next/static`。
2. **生产部署**：本机 PATH 缺 Docker 凭据助手 → `docker-credential-desktop: executable file not found` → 报在 `dockerfile:1` 语法镜像拉取失败，**错误信息极具迷惑性**。
   ```bash
   export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
   bash scripts/deploy.sh
   ```

---

## S-11｜自测断言要防「假 FAIL」与「假 PASS」 ⭐⭐

**今日反复出现**：
- **假 FAIL**：乐观更新+延迟落盘，立即查库读到旧值 → 必须等 `version` 静默 1.2s。
- **假 PASS**：任务书里我自己写错的验收标准。例：让「点热区最右缘归本颗」通过，但该点几何上落在**下一颗字形左半区**（到本颗中心 12px、到下一颗 4px）→ 按此实现会造出**反方向打错分**。被 builder 用几何硬事实驳回。
- **选择器错当 bug 报**：真实 aria-label 是 `标签 父A 更多操作`，我按 `父A 更多操作` 找 → 连续三轮假 FAIL。
- **断言错**：`A.push('字形中心→1 星')` 却拿它跟 `'1 星'` 比较。
- **SQL 陷阱**：见 S-03。

**通用准则**：
- 看到 FAIL 先问「是产品坏了还是我的判据/选择器/时机错了」，**别急着改产品**。
- 写任务书里的验收标准时，**先做几何/时序推演**，别凭直觉写。
- 复现失败要**先确认自己复现的是真问题**再改代码。

---

## S-12｜改造时保护既有已验证行为 ⭐⭐

**今日案例**：星级热区从 14px 扩到 26px 修好了「点不准」，却引入了触屏「打错分」——**修一个 bug 制造了更严重的 bug**。

**规则**：
- 扩大命中区前先量相邻间距，判断会不会重叠（重叠在无 hover 设备 = 打错分）。
- 行为改动后必测**三类回归**：①被修的原症状 ②相邻/边界路径 ③无 hover 的第二环境。
- 本项目已有可复用的实测基线：`docs/qa/QA_CHECKLIST.md` 的 R-1~R-12（本日新增）。

---

## 审查表

| 编号 | 标题 | 采纳？ | 备注/改写意见 |
|---|---|---|---|
| S-01 | 后台无头测试，绝不抢用户前台 | ☐ | |
| S-02 | 隔离实例必须放行 `/api/sync` | ☐ | |
| S-03 | 零污染校验：先认对对象，再用内容级 | ☐ | |
| S-04 | 小控件按「可点击热区」验收 | ☐ | |
| S-05 | 本地配置读不回来：查 SSR 水合 | ☐ | |
| S-06 | 唯一索引 + 全量覆写 = 静默丢数据 | ☐ | |
| S-07 | 事件委托判定命中，不靠 z-index | ☐ | |
| S-08 | 派通道角色前先查目录权限 | ☐ | |
| S-09 | AC 补证必须拆批 | ☐ | |
| S-10 | `next start` 无效 + 部署 PATH 缺凭据 | ☐ | |
| S-11 | 自测断言要防「假 FAIL」与「假 PASS」 | ☐ | |
| S-12 | 改造时保护既有已验证行为 | ☐ | |

> **我的建议**：S-01 / S-02 / S-03 / S-06 / S-08 可沉淀为**项目级 Skill**（强项目相关、复用频率高）；
> S-04 / S-05 / S-07 / S-11 / S-12 属**通用工程方法**，更适合升级到用户级经验库或通用 Skill；
> S-09 / S-10 更适合直接并入 `AGENTS.md` §十一 踩坑（已有部分条目，本次可补齐）。
