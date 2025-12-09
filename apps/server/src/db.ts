import type { Logger } from '@guiiai/logg'
import type { Config, RuntimeFlags } from '@tg-search/common'

import type { CoreDB } from '../../../packages/core/src/db'

import { initDrizzle } from '@tg-search/core'

import { registerMinioMediaStorage } from './storage/minio'

let db: CoreDB | undefined

export async function initDb(logger: Logger, config: Config, flags: RuntimeFlags) {
  try {
    const result = await initDrizzle(logger, config, {
      isDatabaseDebugMode: flags.isDatabaseDebugMode,
      disableMigrations: flags.disableMigrations,
    })

    db = result.db
    logger.log('Database initialized successfully')

    // Attempt to register MinIO-based media storage. When configuration is
    // incomplete or MinIO is unavailable we log a warning and gracefully
    // fall back to storing media bytes in the database.
    await registerMinioMediaStorage(logger)
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
