import type { Logger } from '@unbird/logg'

import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { migrate as migratePg } from '@proj-airi/drizzle-orm-browser-migrator/pg'
import { migrate as migratePGlite } from '@proj-airi/drizzle-orm-browser-migrator/pglite'
import { DatabaseType, flags } from '@tg-search/common'
import { getDatabaseDSN, getDatabaseFilePath, useConfig } from '@tg-search/common/node'
import { Err, Ok } from '@unbird/result'
import { sql } from 'drizzle-orm'
import { drizzle as drizzlePGlite } from 'drizzle-orm/pglite'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import migrations from 'virtual:drizzle-migrations.sql'

interface BaseDB {
  execute: (query: any) => Promise<any>
}

type PostgresDB = ReturnType<typeof drizzle> & BaseDB
type PgliteDB = ReturnType<typeof drizzlePGlite> & BaseDB
export type CoreDB = PostgresDB | PgliteDB

let dbInstance: CoreDB

async function applyMigrations(logger: Logger, db: CoreDB, dbType: DatabaseType) {
  try {
    switch (dbType) {
      case DatabaseType.POSTGRES:
        await migratePg(db as PostgresDB, migrations)
        break
      case DatabaseType.PGLITE:
        await migratePGlite(db as PgliteDB, migrations)
        break
    }
    logger.log('Database migrations applied successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to apply database migrations')
    throw error
  }
}

export async function initDrizzle(logger: Logger) {
  logger.log('Initializing database...')

  // Get configuration
  const config = useConfig()
  const dbType = config.database.type || DatabaseType.POSTGRES

  logger.log(`Using database type: ${dbType}`)

  switch (dbType) {
    case DatabaseType.POSTGRES: {
      // Initialize PostgreSQL database
      const connectionString = getDatabaseDSN(config)
      logger.log(`Connecting to PostgreSQL database: ${connectionString}`)

      const client = postgres(connectionString, {
        max: 1,
        onnotice: (notice) => {
          logger.withFields({ notice }).verbose('Database connection notice')
        },
      })

      dbInstance = drizzle(client, { logger: flags.isDatabaseDebugMode }) as CoreDB
      break
    }

    case DatabaseType.PGLITE: {
      // Initialize PGlite database
      const dbFilePath = getDatabaseFilePath(config)
      logger.log(`Using PGlite database file: ${dbFilePath}`)

      try {
        // Initialize PGlite instance
        const pg = new PGlite(dbFilePath, {
          extensions: { vector },
        })

        // Create Drizzle instance
        dbInstance = drizzlePGlite(pg) as CoreDB

        // Ensure vector extension is enabled
        await dbInstance.execute(sql`ALTER SYSTEM SET vectors.pgvector_compatibility=on;`)
        await dbInstance.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
        logger.log('Vector extension enabled successfully')
      }
      catch (error) {
        logger.withError(error).error('Failed to initialize PGlite database')
        throw error
      }
      break
    }

    default:
      throw new Error(`Unsupported database type: ${dbType}`)
  }

  // Check database connection
  try {
    await dbInstance.execute(sql`select 1`)
    logger.log('Database connection established successfully')

    // Migrate database
    await applyMigrations(logger, dbInstance, dbType)
  }
  catch (error) {
    logger.withError(error).error('Failed to connect to database')
    throw error
  }
}

function useDrizzle() {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }

  return dbInstance
}

export async function withDb<T>(
  fn: (db: CoreDB) => Promise<T>,
) {
  try {
    return Ok(await fn(useDrizzle()))
  }
  catch (error) {
    return Err<T>((error instanceof Error) ? error.cause : error)
  }
}

// export function withDb2<T>(
//   fn: (db: CoreDB) => Promise<T>,
// ): Future<T> {
//   return Async(async () => fn(useDrizzle()))
// }
