// Dev-only PGlite handle for browser-only mode debugging.

import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { CoreDB } from '@tg-search/core'

import { initDrizzle } from '@tg-search/core'

// Typed as any to avoid introducing a hard dependency from client to PGlite.
let pgliteDevDb: any
let dbInstance: CoreDB | undefined

export function usePGliteDevDb(): any {
  return pgliteDevDb
}

export function getDB(): CoreDB {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }

  return dbInstance
}

export async function initDB(logger: Logger, config: Config) {
  const result = await initDrizzle(logger, config, {
    debuggerWebSocketUrl: import.meta.env.VITE_DB_DEBUGGER_WS_URL as string,
    isDatabaseDebugMode: import.meta.env.VITE_DB_DEBUG === 'true',
  })

  pgliteDevDb = result.pglite
  dbInstance = result.db

  return result
}
