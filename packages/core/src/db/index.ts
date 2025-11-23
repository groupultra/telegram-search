import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'

import type { PostgresDB } from './pg'
import type { PgliteDB } from './pglite'

import { DatabaseType, isBrowser } from '@tg-search/common'
import { Err, Ok } from '@unbird/result'

export type CoreDB = PostgresDB | PgliteDB

// Reference: https://github.com/drizzle-team/drizzle-orm/issues/2851#issuecomment-2517850853
export type CoreTransaction = Parameters<Parameters<CoreDB['transaction']>[0]>[0]

let dbInstance: CoreDB

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
  },
) {
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
      })
      break
    }

    case DatabaseType.PGLITE: {
      if (isBrowser()) {
        const { initPgliteDrizzleInBrowser } = await import('./pglite.browser')
        dbInstance = await initPgliteDrizzleInBrowser(logger, {
          isDatabaseDebugMode: options?.isDatabaseDebugMode,
        })
      }
      else {
        const { initPgliteDrizzleInNode } = await import('./pglite')
        dbInstance = await initPgliteDrizzleInNode(logger, config, options?.dbPath, {
          isDatabaseDebugMode: options?.isDatabaseDebugMode,
        })
      }
      break
    }

    default:
      throw new Error(`Unsupported database type: ${dbType}`)
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
