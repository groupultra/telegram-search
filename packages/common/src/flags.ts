import type { DatabaseType } from './config-schema'

import { LoggerFormat, LoggerLevel } from '@unbird/logg'

import { EmbeddingDimension, EmbeddingProvider } from './config-schema'

export interface RuntimeFlags {
  logLevel: LoggerLevel
  logFormat: LoggerFormat

  isDebugMode: boolean
  isDatabaseDebugMode: boolean

  dbProvider?: DatabaseType
  dbUrl?: string

  telegramApiId?: string
  telegramApiHash?: string

  embeddingProvider?: EmbeddingProvider
  embeddingModel?: string
  embeddingDimension?: number
  embeddingApiKey?: string
  embeddingApiBase?: string
}

const DEFAULT_FLAGS: RuntimeFlags = {
  logLevel: LoggerLevel.Verbose,
  logFormat: LoggerFormat.Pretty,

  isDebugMode: false,
  isDatabaseDebugMode: false,
}

const TRUE_VALUES: ReadonlySet<string> = new Set(['1', 'true', 'yes'])

const EMBEDDING_PROVIDER_ALIASES: Readonly<Record<string, EmbeddingProvider>> = {
  openai: EmbeddingProvider.OPENAI,
  ollama: EmbeddingProvider.OLLAMA,
}

function readEnvValue(key: string, env: Record<string, string | undefined>): string | undefined {
  const candidate = env[key] ?? env[key.toLowerCase()] ?? env[key.toUpperCase()]
  if (typeof candidate !== 'string') {
    return undefined
  }

  const trimmed = candidate.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readBooleanEnv(key: string, env: Record<string, string | undefined>): boolean {
  const value = readEnvValue(key, env)
  return value ? TRUE_VALUES.has(value.toLowerCase()) : false
}

function readIntegerEnv(key: string, env: Record<string, string | undefined>): number | undefined {
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

function assignIfPresent<T>(target: T, key: keyof T, value: T[keyof T] | undefined): void {
  if (value !== undefined) {
    target[key] = value
  }
}

export function parseEnvFlags(env: Record<string, string | undefined>): RuntimeFlags {
  const result: RuntimeFlags = { ...DEFAULT_FLAGS }

  const logLevelValue = readEnvValue('LOG_LEVEL', env)
  if (logLevelValue) {
    const normalized = logLevelValue.toLowerCase()
    switch (normalized) {
      case 'debug':
        result.logLevel = LoggerLevel.Debug
        result.isDebugMode = true
        break
      case 'verbose':
        result.logLevel = LoggerLevel.Verbose
        result.isDebugMode = false
        break
    }
  }

  result.isDatabaseDebugMode = readBooleanEnv('DATABASE_DEBUG', env)

  assignIfPresent(result, 'dbProvider', readEnvValue('DATABASE_TYPE', env))
  assignIfPresent(result, 'dbUrl', readEnvValue('DATABASE_URL', env))
  assignIfPresent(result, 'telegramApiId', readEnvValue('TELEGRAM_API_ID', env))
  assignIfPresent(result, 'telegramApiHash', readEnvValue('TELEGRAM_API_HASH', env))

  const embeddingProviderValue = readEnvValue('EMBEDDING_PROVIDER', env)
  if (embeddingProviderValue) {
    const normalized = embeddingProviderValue.toLowerCase()
    const provider = EMBEDDING_PROVIDER_ALIASES[normalized]
    if (provider) {
      result.embeddingProvider = provider
    }
  }

  assignIfPresent(result, 'embeddingModel', readEnvValue('EMBEDDING_MODEL', env))

  const embeddingDimensionValue = readIntegerEnv('EMBEDDING_DIMENSION', env)
  if (
    typeof embeddingDimensionValue === 'number'
    && Object.values(EmbeddingDimension).includes(embeddingDimensionValue as EmbeddingDimension)
  ) {
    result.embeddingDimension = embeddingDimensionValue
  }

  assignIfPresent(result, 'embeddingApiKey', readEnvValue('EMBEDDING_API_KEY', env))
  assignIfPresent(result, 'embeddingApiBase', readEnvValue('EMBEDDING_BASE_URL', env))

  // eslint-disable-next-line no-console
  console.log('Flags parsed', result)

  return result
}
