import type { DatabaseConfig } from './config-schema'

export function getDatabaseDSN(database: DatabaseConfig): string {
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}
