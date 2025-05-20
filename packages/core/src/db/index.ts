import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { DatabaseType, flags, useLogger } from '@tg-search/common'
import { getDatabaseDSN, getDatabaseFilePath, useConfig } from '@tg-search/common/composable'
import Database from 'better-sqlite3'
import { sql } from 'drizzle-orm'
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePGlite } from 'drizzle-orm/pglite'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import vectorlite from 'vectorlite'

import { Err, Ok } from '../utils/monad'

const { vectorlitePath } = vectorlite

export type CoreDB = ReturnType<typeof drizzle>
let dbInstance: CoreDB

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

      dbInstance = drizzle(client, { logger: flags.isDatabaseDebugMode })
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
        dbInstance = drizzlePGlite(pg)

        // Ensure vector extension is enabled
        await dbInstance.execute(sql`
          ALTER SYSTEM SET vectors.pgvector_compatibility=on;
          CREATE EXTENSION IF NOT EXISTS vectors;
        `)
      }
      catch (error) {
        logger.withError(error).error('Failed to initialize PGlite database')
        throw error
      }
      break
    }

    case DatabaseType.SQLITE_VEC: {
      // Initialize SQLite + Vector database
      const dbFilePath = getDatabaseFilePath(config)
      logger.log(`Using SQLite+Vector database file: ${dbFilePath}`)

      try {
        // Initialize SQLite instance
        const sqlite = new Database(dbFilePath)

        // Load vectorlite extension
        try {
          sqlite.loadExtension(vectorlitePath())
          logger.log('Loaded vectorlite extension')
        }
        catch (error) {
          logger.withError(error).error('Failed to load vectorlite extension, vector search functionality will not be available')
        }

        // Create Drizzle instance
        dbInstance = drizzleSQLite(sqlite)
      }
      catch (error) {
        logger.withError(error).error('Failed to initialize SQLite+Vector database')
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
    return Err<T>(error)
  }
}

// export function withDb2<T>(
//   fn: (db: CoreDB) => Promise<T>,
// ): Future<T> {
//   return Async(async () => fn(useDrizzle()))
// }
