import type { Results } from '@electric-sql/pglite'
import type { Logger } from '@unbird/logg'
import type { drizzle as drizzlePglite } from 'drizzle-orm/pglite'

import { IdbFs, PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { migrate } from '@proj-airi/drizzle-orm-browser-migrator/pglite'
import { flags } from '@tg-search/common'
import { defineInvokeEventa, defineInvokeHandler } from '@unbird/eventa'
import { createContext } from '@unbird/eventa/adapters/websocket/native'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import migrations from 'virtual:drizzle-migrations.sql'

import { Conn } from '../ws'

type PgliteDB = ReturnType<typeof drizzlePglite>

async function applyMigrations(logger: Logger, db: PgliteDB) {
  try {
    await migrate(db, migrations)
  }
  catch (error) {
    logger.withError(error).error('Failed to apply database migrations')
    throw error
  }
}

export async function initPgliteDrizzleInBrowser(logger: Logger, options?: { debuggerWebSocketUrl?: string }) {
  logger.log('Initializing database...')

  try {
    logger.log('Using PGlite in browser')
    const pglite = new PGlite({
      extensions: { vector },
      fs: new IdbFs('pglite'),
    })

    if (options?.debuggerWebSocketUrl) {
      const queryInvoke = defineInvokeEventa<Promise<{ result: Results<unknown> }>, { statement: string, parameters?: any[] }>('deditor:database:postgres:query')

      const conn = new Conn(options.debuggerWebSocketUrl, { autoConnect: true, autoReconnect: true })
      await conn.connect()
      const { context } = createContext(conn.websocket!)

      defineInvokeHandler(context, queryInvoke, async ({ statement, parameters }) => {
        const res = await pglite.query(statement, parameters)
        return { result: res }
      })
    }

    // Create Drizzle instance
    const db = drizzle(pglite, { logger: flags.isDatabaseDebugMode }) as PgliteDB

    // Check database connection
    try {
      await db.execute(sql`select 1`)
      logger.log('Database connection established successfully')

      // Ensure vector extension is enabled
      await db.execute(sql`ALTER SYSTEM SET vectors.pgvector_compatibility=on;`)
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
      logger.log('Vector extension enabled successfully')

      // Migrate database
      await applyMigrations(logger, db)
    }
    catch (error) {
      logger.withError(error).error('Failed to connect to database')
      throw error
    }

    return db
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize PGlite database')
    throw error
  }
}
