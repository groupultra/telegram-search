import type { SQL } from 'drizzle-orm'

import { sql } from 'drizzle-orm'
import { customType } from 'drizzle-orm/pg-core'

/**
 * Create a vector column definition
 */
export const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(1536)'
  },
})

/**
 * Convert array to vector
 */
export function arrayToVector(array: number[]): SQL {
  return sql`${sql.raw(`'[${array.join(',')}]'::vector`)}`
}

/**
 * Create a vector similarity search index with default options
 */
export function createDefaultVectorIndex(
  tableName: string,
  column: string,
  chatId: number | bigint,
): SQL {
  // 使用 n 前缀表示负数，处理 BigInt
  const absId = chatId < 0 ? -chatId : chatId
  const prefix = chatId < 0 ? 'n' : ''
  const indexName = `messages_${prefix}${absId}_${column}_idx`

  return sql`CREATE INDEX IF NOT EXISTS ${sql.raw(indexName)}
    ON ${sql.raw(tableName)}
    USING ivfflat (${sql.raw(column)} vector_cosine_ops)
    WITH (lists = 100)`
}
