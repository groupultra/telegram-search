import type { MessageWithSimilarity } from '@tg-search/db'
import type { PaginationParams } from '../api'

/**
 * Search request parameters
 */
export interface SearchRequest extends PaginationParams {
  query: string
  folderId?: number
  chatId?: number
  useVectorSearch?: boolean

  [key: string]: unknown
}

/**
 * Search result item with relevance score
 */
export interface SearchResultItem extends MessageWithSimilarity {
  score: number
}

/**
 * Search complete response
 */
export interface SearchCompleteResponse {
  duration: number
  total: number
  results: SearchResultItem[]
}
