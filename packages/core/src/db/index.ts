import { useLogger } from '@tg-search/common'
import { getDatabaseDSN, useConfig } from '@tg-search/common/composable'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

let dbInstance: ReturnType<typeof drizzle>

export async function initDrizzle() {
  const logger = useLogger()
  logger.debug('Initializing database...')

  // Database connection
  const config = useConfig()
  const connectionString = getDatabaseDSN(config)
  const client = postgres(connectionString, {
    max: 1,
    onnotice: (notice) => {
      logger.withFields({ notice }).debug('Database connection notice')
    },
  })

  dbInstance = drizzle(client)

  // Check the db connection
  try {
    await dbInstance.execute(sql`select 1`)
  }
  catch (error) {
    logger.withError(error).error('Failed to connect to database')
    throw error
  }
}

export function useDrizzle() {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }

  return dbInstance
}
