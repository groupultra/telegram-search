import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'

import postgres from 'postgres'

import { migrate as migratePg } from '@proj-airi/drizzle-orm-browser-migrator/pg'
import { getDatabaseDSN } from '@tg-search/common'
import { migrations } from '@tg-search/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'

export type PostgresDB = ReturnType<typeof drizzlePg>

async function applyMigrations(logger: Logger, db: PostgresDB) {
  try {
    await migratePg(db as PostgresDB, migrations)
  }
  catch (error) {
    logger.withError(error).error('Failed to apply database migrations')
    throw error
  }
}

async function ensureVectorExtension(logger: Logger, db: PostgresDB) {
  // For pgvector-rs compatibility
  try {
    await db.execute(sql`ALTER SYSTEM SET vectors.pgvector_compatibility=on;`)
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vectors;`)
    logger.log('pgvector-rs extension enabled successfully')
    return
  }
  catch {}

  // For pgvector compatibility
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
    logger.log('pgvector extension enabled successfully')
  }
  catch {}
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

  const client = postgres(connectionString, {
    max: 1,
    onnotice: (notice) => {
      logger.withFields({ notice }).debug('Database connection notice')
    },
  })

  const db = drizzle(client, { logger: !!options.isDatabaseDebugMode }) as PostgresDB

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
