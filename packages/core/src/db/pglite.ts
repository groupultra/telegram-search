import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { drizzle as drizzlePglite } from 'drizzle-orm/pglite'

import fs from 'node:fs'

import path from 'pathe'
import migrations from 'virtual:drizzle-migrations.sql'

import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { migrate } from '@proj-airi/drizzle-orm-browser-migrator/pglite'
import { getDatabaseFilePath } from '@tg-search/common/node'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'

export type PgliteDB = ReturnType<typeof drizzlePglite>

async function applyMigrations(logger: Logger, db: PgliteDB) {
  try {
    await migrate(db, migrations)
  }
  catch (error) {
    logger.withError(error).error('Failed to apply database migrations')
    throw error
  }
}

export async function initPgliteDrizzleInNode(
  logger: Logger,
  config: Config,
  dbPath?: string,
  options: {
    isDatabaseDebugMode?: boolean
    disableMigrations?: boolean
  } = {},
) {
  logger.log('Initializing pglite drizzle...')

  try {
    const dbFilePath = dbPath || getDatabaseFilePath(config)
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true })
    logger.log(`Using PGlite in node: ${dbFilePath}`)
    const pglite = new PGlite(dbFilePath, {
      extensions: { vector },
    })

    // Create Drizzle instance
    const db = drizzle(pglite, { logger: !!options.isDatabaseDebugMode }) as PgliteDB

    // Check database connection
    try {
      await db.execute(sql`select 1`)
      logger.log('Database connection established successfully')

      // Ensure vector extension is enabled
      await db.execute(sql`ALTER SYSTEM SET vectors.pgvector_compatibility=on;`)
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
      logger.log('Vector extension enabled successfully')

      // Migrate database
      if (!options.disableMigrations) {
        await applyMigrations(logger, db)
      }
    }
    catch (error) {
      logger.withError(error).error('Failed to connect to database')
      throw error
    }

    return { db, pglite }
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize PGlite database')
    throw error
  }
}
