import type { Config } from '../types/config'

/**
 * Get database connection string from config
 */
export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}
