import { loadSettings } from '@/lib/storage'

/**
 * P1-AI1：从本机 localStorage 读取 AI 配置，生成随 /api/ai/* 请求传输的请求头。
 * API Key 只保存在本机（不进入共享同步快照），服务端仅在本次请求内使用。
 */
export function aiRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (typeof window === 'undefined') return headers
  const s = loadSettings()
  if (s.aiProvider) headers['x-ai-provider'] = s.aiProvider
  if (s.aiModel) headers['x-ai-model'] = s.aiModel
  if (s.aiBaseUrl) headers['x-ai-base-url'] = s.aiBaseUrl
  if (s.aiApiKey) headers['x-ai-api-key'] = s.aiApiKey
  return headers
}