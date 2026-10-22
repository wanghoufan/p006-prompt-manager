/**
 * GitHub Pages 静态试用版开关。
 *
 * 只有 Pages 构建（STATIC_EXPORT=1）时才注入 NEXT_PUBLIC_STATIC_TRIAL=1：
 * - 数据只走浏览器 localStorage，不探测 /api/sync、不推送、不订阅 SSE；
 * - 云同步、MCP 令牌与 AI 代理（/api/ai/*）在静态站不可用，入口需明确降级。
 * Docker / 本地开发不设该变量，行为保持不变。
 */
export const IS_STATIC_TRIAL = process.env.NEXT_PUBLIC_STATIC_TRIAL === '1'
