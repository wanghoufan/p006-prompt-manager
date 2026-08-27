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

/** 标签实体：与 Prompt 完全解耦，通过稳定 id 关联（交接 §38）。
 *  重命名/移动只改 Tag 自身字段，不改任何 Prompt；删除 Tag 级联删关系但不删 Prompt。 */
export interface Tag {
  id: string
  name: string
  /** 父标签 id；null = 顶级标签 */
  parent_id: string | null
  /** 可选 emoji / 图标名（P1 启用，默认 null） */
  icon: string | null
  /** 置顶（P1 启用，默认 false） */
  is_pinned: boolean
  /** 同级排序（P1 启用，默认 0） */
  sort_order: number
  created_at: string
  updated_at: string
}

/** Prompt 与 Tag 的多对多关联（交接 §38）。应用层强制 (prompt_id, tag_id) 唯一。 */
export interface PromptTag {
  prompt_id: string
  tag_id: string
}

export type SortMode = 'updated' | 'copies' | 'rating'

export interface GenerateMetaResult {
  title: string
  tags: string[]
}