import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'

import type { PostgresDB } from './pg'
import type { PgliteDB } from './pglite'

import { DatabaseType, isBrowser } from '@tg-search/common'

export type CoreDB = PostgresDB | PgliteDB

// Reference: https://github.com/drizzle-team/drizzle-orm/issues/2851#issuecomment-2517850853
export type CoreTransaction = Parameters<Parameters<CoreDB['transaction']>[0]>[0]

let dbInstance: CoreDB

export interface InitDrizzleResult {
  db: CoreDB
  /**
   * Underlying PGlite instance when DatabaseType.PGLITE is used.
   * Undefined for Postgres or when running in environments without PGlite.
   */
  pglite?: any
}

/**
 * Set the global database instance.
 *
 * In production this is called indirectly via initDrizzle.
 * In tests you can inject a mock implementation (for example, drizzle.mock()).
 */
export function setDbInstanceForTests(db: unknown) {
  dbInstance = db as CoreDB
}

// TODO: options? here should contain dbPath, config.
export async function initDrizzle(
  logger: Logger,
  config: Config,
  options?: {
    dbPath?: string
    debuggerWebSocketUrl?: string
    isDatabaseDebugMode?: boolean
    disableMigrations?: boolean
  },
): Promise<InitDrizzleResult> {
  logger.log('Initializing database...')

  // Get configuration
  let dbType = config.database.type || DatabaseType.PGLITE
  if (isBrowser()) {
    dbType = DatabaseType.PGLITE
  }

  logger.log(`Using database type: ${dbType}`)

  switch (dbType) {
    case DatabaseType.POSTGRES: {
      const { initPgDrizzle } = await import('./pg')
      dbInstance = await initPgDrizzle(logger, config, {
        isDatabaseDebugMode: options?.isDatabaseDebugMode,
        disableMigrations: options?.disableMigrations,
      })
      return { db: dbInstance }
    }

    case DatabaseType.PGLITE: {
      if (isBrowser()) {
        const { initPgliteDrizzleInBrowser } = await import('./pglite.browser')
        const { db, pglite } = await initPgliteDrizzleInBrowser(logger, {
          debuggerWebSocketUrl: options?.debuggerWebSocketUrl,
          isDatabaseDebugMode: options?.isDatabaseDebugMode,
          disableMigrations: options?.disableMigrations,
        })
        dbInstance = db
        return { db, pglite }
      }
      else {
        const { initPgliteDrizzleInNode } = await import('./pglite')
        const { db, pglite } = await initPgliteDrizzleInNode(logger, config, options?.dbPath, {
          isDatabaseDebugMode: options?.isDatabaseDebugMode,
          disableMigrations: options?.disableMigrations,
        })
        dbInstance = db
        return { db, pglite }
      }
    }

    default:
      throw new Error(`Unsupported database type: ${dbType}`)
  }
}

export function useDrizzle() {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }

  return dbInstance
}
