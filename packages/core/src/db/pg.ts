import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'

import postgres from 'postgres'
import migrations from 'virtual:drizzle-migrations.sql'

import { migrate as migratePg } from '@proj-airi/drizzle-orm-browser-migrator/pg'
import { getDatabaseDSN } from '@tg-search/common'
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
      logger.withFields({ notice }).verbose('Database connection notice')
    },
  })

  const db = drizzle(client, { logger: !!options.isDatabaseDebugMode }) as PostgresDB

  // Check database connection
  try {
    await db.execute(sql`select 1`)
    logger.log('Database connection established successfully')

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
