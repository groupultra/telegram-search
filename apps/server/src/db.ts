import type { Logger } from '@guiiai/logg'
import type { Config, RuntimeFlags } from '@tg-search/common'

import type { CoreDB } from '../../../packages/core/src/db'

import { initDrizzle } from '@tg-search/core'

let db: CoreDB | undefined

export async function initDb(logger: Logger, config: Config, flags: RuntimeFlags) {
  try {
    const result = await initDrizzle(logger, config, {
      isDatabaseDebugMode: flags.isDatabaseDebugMode,
      disableMigrations: flags.disableMigrations,
    })

    db = result.db
    logger.log('Database initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize database')
    throw error
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized')
  }

  return db
}
