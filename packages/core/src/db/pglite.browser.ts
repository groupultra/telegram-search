import type { Results } from '@electric-sql/pglite'
import type { Logger } from '@guiiai/logg'
import type { drizzle as drizzlePglite } from 'drizzle-orm/pglite'

import { IdbFs, PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { defineInvokeEventa, defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/websocket/native'
import { migrate } from '@proj-airi/drizzle-orm-browser-migrator/pglite'
import { migrations } from '@tg-search/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'

import { Conn } from '../libs/ws'

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

export async function initPgliteDrizzleInBrowser(
  logger: Logger,
  options: {
    debuggerWebSocketUrl?: string
    isDatabaseDebugMode?: boolean
    disableMigrations?: boolean
  } = {},
) {
  logger.log('Initializing pglite drizzle in browser...')

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

        // eslint-disable-next-line no-console
        console.debug(statement, parameters, res)

        return { result: res }
      })
    }

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
