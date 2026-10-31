import type { Card } from '@/lib/types'

/**
 * GitHub Pages 静态试用版开关。
 *
 * 只有 Pages 构建（STATIC_EXPORT=1）时才注入 NEXT_PUBLIC_STATIC_TRIAL=1：
 * - 数据只走浏览器 localStorage，不探测 /api/sync、不推送、不订阅 SSE；
 * - 云同步、MCP 令牌与 AI 代理（/api/ai/*）在静态站不可用，入口需明确降级。
 * Docker / 本地开发不设该变量，行为保持不变。
 */
export const IS_STATIC_TRIAL = process.env.NEXT_PUBLIC_STATIC_TRIAL === '1'

/**
 * 内置试调取卡：访客首次打开试用版时播种一张，用来验证 MCP 链路真的通。
 *
 * 设计取舍（2026-10-31 用户要求）：调取码固定为 `hi`，正文让模型自报身份——
 * 访客装好 MCP 后说「调取 hi」，模型会报出自己是什么模型、能做什么，
 * 一眼就能确认「调取码 → 卡片激活」这条链是活的。
 *
 * 卡片正文刻意写得很短：它是给模型执行的最小指令，不是给人读的说明。
 */
export const TRIAL_STARTER_CODE = 'hi'

export function buildTrialStarterCard(now: string = new Date().toISOString()): Card {
  return {
    id: 'trial-starter-hi',
    title: '让 AI 报出自己是谁',
    body: '你是什么模型，你能做什么',
    tags: [],
    code: TRIAL_STARTER_CODE,
    rating: 0,
    copyCount: 0,
    thinkingSummary: null,
    notes: '内置的试调取卡：装好 MCP 后对 AI 说「调取 hi」，它会报出自己的模型与能力，用来确认链路通了。',
    sourceUrl: '',
    versions: [],
    createdAt: now,
    updatedAt: now,
  }
}
