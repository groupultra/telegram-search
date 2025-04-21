import { getDatabaseDSN, useConfig, useLogger } from '@tg-search/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

let dbInstance: ReturnType<typeof drizzle>

export function initDrizzle() {
  const logger = useLogger()
  logger.debug('Initializing database...')

  // Database connection
  const config = useConfig()
  const connectionString = getDatabaseDSN(config)
  const client = postgres(connectionString, {
    max: 1,
    onnotice: () => {},
  })

  dbInstance = drizzle(client)
}

export function useDrizzle() {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }

  return dbInstance
}
