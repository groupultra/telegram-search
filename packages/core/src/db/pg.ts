import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'

import pg from 'pg'

import { migrate as migratePg } from '@proj-airi/drizzle-orm-browser-migrator/pg'
import { getDatabaseDSN } from '@tg-search/common'
import { migrations } from '@tg-search/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

import * as schema from '../schemas/index'

export type PostgresDB = ReturnType<typeof drizzlePg<typeof schema>>

async function applyMigrations(logger: Logger, db: PostgresDB) {
  try {
    // NOTICE: browser-migrator types declare PostgresJsDatabase, but the runtime API
    // (db.execute / db.transaction) is identical for node-postgres. Safe to cast.
    // TODO: upstream the type fix to @proj-airi/drizzle-orm-browser-migrator
    await migratePg(db as any, migrations)
  }
  catch (error) {
    logger.withError(error).error('Failed to apply database migrations')
    throw error
  }
}

async function ensureVectorExtension(logger: Logger, db: PostgresDB) {
  let vectorsError: unknown
  // For pgvector-rs compatibility
  try {
    await db.execute(sql`ALTER SYSTEM SET vectors.pgvector_compatibility=on;`)
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vectors;`)
    logger.log('pgvector-rs extension enabled successfully')
    return
  }
  catch (error) {
    vectorsError = error
    logger.withError(error).warn('Failed to enable vectors extension, falling back to pgvector')
  }

  // For pgvector compatibility
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
    logger.log('pgvector extension enabled successfully')
  }
  catch (error) {
    logger.withFields({ vectorsError }).withError(error).error('Failed to enable any vector extension')
    throw new Error('Failed to enable vector extension', { cause: error })
  }
}

export async function initPgDrizzle(
  logger: Logger,
  config: Config,
  options: {
    isDatabaseDebugMode?: boolean
    disableMigrations?: boolean
  } = {},
) {
  logger.log('Initializing postgres drizzle...')

  // Initialize PostgreSQL database
  const connectionString = getDatabaseDSN(config.database)
  logger.log(`Connecting to PostgreSQL database: ${connectionString}`)

  const pool = new pg.Pool({ connectionString })
  pool.on('error', (err) => {
    logger.withError(err).error('Unexpected pool error')
  })

  const db = drizzle(pool, {
    logger: !!options.isDatabaseDebugMode,
    schema,
  })

  // Check database connection
  try {
    await db.execute(sql`select 1`)
    logger.log('Database connection established successfully')

    // Ensure vector extension is enabled
    await ensureVectorExtension(logger, db)

    // Migrate database
    if (!options.disableMigrations) {
      await applyMigrations(logger, db)
    }
  }
  catch (error) {
    logger.withError(error).error('Failed to connect to database')
    throw error
  }

  return db
}
