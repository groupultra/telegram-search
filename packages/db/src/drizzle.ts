import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { DatabaseType, flags, useLogger } from '@tg-search/common'
import { getDatabaseDSN, getDatabaseFilePath, getDrizzlePath, useConfig } from '@tg-search/common/node'
import { Err, Ok } from '@tg-search/common/utils/monad'
import { sql } from 'drizzle-orm'
import { drizzle as drizzlePGlite } from 'drizzle-orm/pglite'
import { migrate as migratePGlite } from 'drizzle-orm/pglite/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

interface BaseDB {
  execute: (query: any) => Promise<any>
}

export type CoreDB
  = | (PostgresJsDatabase<Record<string, unknown>> & { $client: ReturnType<typeof postgres> } & BaseDB)
    | (PgliteDatabase<Record<string, unknown>> & { $client: PGlite } & BaseDB)

let dbInstance: CoreDB

async function applyMigrations(db: CoreDB, dbType: DatabaseType) {
  const logger = useLogger()
  const migrationsFolder = await getDrizzlePath()
  logger.log(`Running migrations from: ${migrationsFolder}`)

  try {
    switch (dbType) {
      case DatabaseType.POSTGRES:
        await migratePg(db as PostgresJsDatabase<Record<string, unknown>>, { migrationsFolder })
        break
      case DatabaseType.PGLITE:
        await migratePGlite(db as PgliteDatabase<Record<string, unknown>>, { migrationsFolder })
        break
    }
    logger.log('Database migrations applied successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to apply database migrations')
    throw error
  }
}

export async function initDrizzle() {
  const logger = useLogger()
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
    await applyMigrations(dbInstance, dbType)
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
