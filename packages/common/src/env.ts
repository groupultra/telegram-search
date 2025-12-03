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

export function parseEnvToConfig(env: Environment): Config {
  const partialConfig = {
    database: {
      url: readEnvValue('DATABASE_URL', env),
      type: readEnvValue('DATABASE_TYPE', env),
    },
    api: {
      telegram: {
        apiId: readEnvValue('TELEGRAM_API_ID', env),
        apiHash: readEnvValue('TELEGRAM_API_HASH', env),
        receiveMessage: readBooleanEnv('TELEGRAM_RECEIVE_MESSAGE', env),
        proxy: {
          proxyUrl: readEnvValue('PROXY_URL', env),
          ip: readEnvValue('PROXY_IP', env),
          port: readIntegerEnv('PROXY_PORT', env),
          MTProxy: readBooleanEnv('PROXY_MT_PROXY', env),
          secret: readEnvValue('PROXY_SECRET', env),
          socksType: readIntegerEnv('PROXY_SOCKS_TYPE', env),
          timeout: readIntegerEnv('PROXY_TIMEOUT', env),
          username: readEnvValue('PROXY_USERNAME', env),
          password: readEnvValue('PROXY_PASSWORD', env),
        },
      },
      embedding: {
        provider: readEnvValue('EMBEDDING_PROVIDER', env),
        model: readEnvValue('EMBEDDING_MODEL', env),
        apiKey: readEnvValue('EMBEDDING_API_KEY', env),
        apiBase: readEnvValue('EMBEDDING_API_BASE', env),
        dimension: readIntegerEnv('EMBEDDING_DIMENSION', env),
      },
    },
  } as Partial<Config>

  const parsedConfig = safeParse(configSchema, partialConfig)
  if (!parsedConfig.success) {
    throw new Error('Failed to parse config', { cause: parsedConfig.issues })
  }

  return parsedConfig.output
}

export function mergeConfigWithEnv(env: Environment, config: Config): Config {
  const parsedConfig = parseEnvToConfig(env)
  return defu(config, parsedConfig)
}
