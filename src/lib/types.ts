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
  /** 用户自填的备注：何时用、注意事项等。空串视为未填写。 */
  notes: string
  versions: Version[]
  createdAt: string
  updatedAt: string
}

export interface Settings {
  thinkingSummaryPrompt: string
  /** P0-4：网格直删前是否二次确认（默认 true） */
  confirmDelete: boolean
  /** P0-5：外观主题；system 跟随系统偏好，dark/light 手动覆盖 */
  theme: 'dark' | 'light' | 'system'
}

export type SortMode = 'updated' | 'copies' | 'rating'

export interface GenerateMetaResult {
  title: string
  tags: string[]
}