import type { DatabaseConfig } from './config-schema'

export function getDatabaseDSN(database: DatabaseConfig): string {
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

interface MinioConnectionOptions {
  endPoint: string
  port: number
  useSSL: boolean
}

export function parseMinioDSN(dsn: string): MinioConnectionOptions {
  const HTTPS_DEFAULT_PORT = 443
  const HTTP_DEFAULT_PORT = 80

  const url = new URL(dsn)

  const endPoint = url.hostname
  const useSSL = url.protocol === 'https:'

  let port = Number(url.port)

  // Cannot obtain port (0 or NaN), fill with default port of protocol
  if (port === 0) {
    port = useSSL ? HTTPS_DEFAULT_PORT : HTTP_DEFAULT_PORT
  }

  if (!endPoint) {
    throw new Error('Invalid Minio DSN')
  }

  return { endPoint, port, useSSL }
}
