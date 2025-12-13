import type { Logger } from '@guiiai/logg'

import type { Config } from './config-schema'

import { defu } from 'defu'
import { safeParse } from 'valibot'

import { configSchema } from './config-schema'

const TRUE_VALUES: ReadonlySet<string> = new Set(['1', 'true', 'yes'])
type Environment = Record<string, string | undefined>

export function readEnvValue<T extends string>(key: string, env: Environment): T | undefined {
  const candidate = env[key] ?? env[key.toLowerCase()] ?? env[key.toUpperCase()]
  if (typeof candidate !== 'string') {
    return undefined
  }

  const trimmed = candidate.trim()
  return trimmed.length > 0 ? (trimmed as T) : undefined
}

export function readBooleanEnv(key: string, env: Environment): boolean {
  const value = readEnvValue(key, env)
  return value ? TRUE_VALUES.has(value.toLowerCase()) : false
}

export function readIntegerEnv(key: string, env: Environment): number | undefined {
  const rawValue = readEnvValue(key, env)
  if (!rawValue) {
    return undefined
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (Number.isInteger(parsed)) {
    return parsed
  }

  return undefined
}

export function readStringEnv(keys: string[], env: Environment): string | undefined {
  for (const key of keys) {
    const value = readEnvValue(key, env)
    if (value) {
      return value
    }
  }
  return undefined
}

export function parseEnvToConfig(env: Environment, logger?: Logger): Config {
  const partialConfig = {
    database: {
      url: readEnvValue('DATABASE_URL', env),
      type: readEnvValue('DATABASE_TYPE', env),
    },
    api: {
      telegram: {
        apiId: readStringEnv(['TELEGRAM_API_ID', 'TELEGRAM_APP_ID', 'VITE_TELEGRAM_API_ID', 'VITE_TELEGRAM_APP_ID'], env),
        apiHash: readStringEnv(['TELEGRAM_API_HASH', 'TELEGRAM_APP_HASH', 'VITE_TELEGRAM_API_HASH', 'VITE_TELEGRAM_APP_HASH'], env),
        proxy: {
          MTProxy: readBooleanEnv('PROXY_MT_PROXY', env),
          proxyUrl: readEnvValue('PROXY_URL', env),
        },
      },
    },
    minio: {
      bucket: readEnvValue('MINIO_BUCKET', env),
      endpoint: readEnvValue('MINIO_ENDPOINT', env),
      port: readIntegerEnv('MINIO_PORT', env),
      accessKey: readEnvValue('MINIO_ACCESS_KEY', env),
      secretKey: readEnvValue('MINIO_SECRET_KEY', env),
      useSSL: readBooleanEnv('MINIO_USE_SSL', env),
    },
    otel: {
      endpoint: readEnvValue('OTEL_EXPORTER_OTLP_ENDPOINT', env),
    },
  }

  const parsedConfig = safeParse(configSchema, partialConfig)
  if (!parsedConfig.success) {
    throw new Error('Failed to parse config', { cause: parsedConfig.issues })
  }

  logger?.withFields({ config: parsedConfig.output }).debug('Config parsed')

  return parsedConfig.output
}

export function mergeConfigWithEnv(env: Environment, config: Config): Config {
  const parsedConfig = parseEnvToConfig(env)
  return defu(config, parsedConfig)
}
