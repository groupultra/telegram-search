import type { Config } from '@tg-search/common'
import type { Logger } from '@unbird/logg'

import type { PostgresDB } from './pg'
import type { PgliteDB } from './pglite'

import { DatabaseType } from '@tg-search/common'
import { isBrowser } from '@unbird/logg/utils'
import { Err, Ok } from '@unbird/result'

export type CoreDB = PostgresDB | PgliteDB

let dbInstance: CoreDB

export async function initDrizzle(logger: Logger, config: Config, dbPath?: string) {
  logger.log('Initializing database...')

  // Get configuration
  const dbType = config.database.type || DatabaseType.PGLITE
  logger.log(`Using database type: ${dbType}`)

  switch (dbType) {
    case DatabaseType.POSTGRES: {
      const { initPgDrizzle } = await import('./pg')
      dbInstance = await initPgDrizzle(logger, config)
      break
    }

    case DatabaseType.PGLITE: {
      if (isBrowser()) {
        const { initPgliteDrizzleInBrowser } = await import('./pglite.browser')
        dbInstance = await initPgliteDrizzleInBrowser(logger)
      }
      else {
        const { initPgliteDrizzleInNode } = await import('./pglite')
        dbInstance = await initPgliteDrizzleInNode(logger, config, dbPath)
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
