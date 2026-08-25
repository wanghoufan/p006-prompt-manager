export interface Version {
  id: string
  body: string
  createdAt: string
}

export interface Card {
  id: string
  title: string
  body: string
  tags: string[]
  /** 调取码：用户自定义短字符串，供 MCP 等外部工具按码取卡片，可选 */
  code: string | null
  rating: number
  copyCount: number
  thinkingSummary: string | null
  versions: Version[]
  createdAt: string
  updatedAt: string
}

export interface Settings {
  thinkingSummaryPrompt: string
}

export type SortMode = 'updated' | 'copies' | 'rating'

export interface GenerateMetaResult {
  title: string
  tags: string[]
}