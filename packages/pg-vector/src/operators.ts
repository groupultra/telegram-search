import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import { sql } from 'drizzle-orm'

/**
 * Calculate L2 distance between two vectors
 */
export function l2Distance(column: PgColumn, vector: number[]): SQL {
  return sql`${column} <-> ${sql.raw(`'[${vector.join(',')}]'::vector`)}`
}

/**
 * Calculate inner product distance between two vectors
 */
export function ipDistance(column: PgColumn, vector: number[]): SQL {
  return sql`${column} <#> ${sql.raw(`'[${vector.join(',')}]'::vector`)}`
}

/**
 * Calculate cosine distance between two vectors
 */
export function cosineDistance(column: PgColumn, vector: number[]): SQL {
  return sql`1 - (${column} <=> ${sql.raw(`'[${vector.join(',')}]'::vector`)})`
}

/**
 * Create a vector similarity search index
 */
export function createVectorIndex(
  table: string,
  column: string,
  indexName: string,
  options: {
    lists?: number
    probes?: number
    distance?: 'l2' | 'ip' | 'cosine'
  } = {},
): SQL {
  const {
    lists = 100,
    probes = 1,
    distance = 'cosine',
  } = options

  const distanceOp = distance === 'l2'
    ? 'vector_l2_ops'
    : distance === 'ip'
      ? 'vector_ip_ops'
      : 'vector_cosine_ops'

  return sql`CREATE INDEX IF NOT EXISTS ${sql.raw(indexName)}
    ON ${sql.raw(table)}
    USING ivfflat (${sql.raw(column)} ${sql.raw(distanceOp)})
    WITH (lists = ${lists}, probes = ${probes})`
}
