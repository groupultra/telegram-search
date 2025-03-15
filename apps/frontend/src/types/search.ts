export interface SearchResult {
  id: number
  chatId: number
  fromId?: number
  fromName?: string
  type: string
  content: string
  createdAt: string
  score: number
}

export interface SearchResponse {
  success: boolean
  error?: Error
  total?: number
  results?: SearchResult[]
}
