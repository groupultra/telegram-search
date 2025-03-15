import type { TelegramMessage } from '@tg-search/core'
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
export interface SearchResultItem extends TelegramMessage {
  score: number
}

/**
 * Search complete response
 */
export interface SearchCompleteResponse {
  duration: number
  total: number
}
