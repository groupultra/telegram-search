import type { SQL } from 'drizzle-orm'

import { EmbeddingDimension } from '@tg-search/common'
import { cosineDistance, sql } from 'drizzle-orm'

import { chatMessagesTable } from '../../schemas/chat_messages'

export function getSimilaritySql(dimension: EmbeddingDimension, embedding: number[]) {
  let similarity: SQL<number>

  switch (dimension) {
    case EmbeddingDimension.DIMENSION_1536:
      similarity = sql<number>`(1 - (${cosineDistance(chatMessagesTable.content_vector_1536, embedding)}))`
      break
    case EmbeddingDimension.DIMENSION_1024:
      similarity = sql<number>`(1 - (${cosineDistance(chatMessagesTable.content_vector_1024, embedding)}))`
      break
    case EmbeddingDimension.DIMENSION_768:
      similarity = sql<number>`(1 - (${cosineDistance(chatMessagesTable.content_vector_768, embedding)}))`
      break
    default:
      throw new Error(`Unsupported embedding dimension: ${dimension}`)
  }

  return similarity
}
