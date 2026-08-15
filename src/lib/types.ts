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