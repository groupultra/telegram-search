import { LoggerFormat, LoggerLevel } from '@unbird/logg'

import { EmbeddingDimension, EmbeddingProvider } from './config-schema'

export interface RuntimeFlags {
  logLevel: LoggerLevel
  logFormat: LoggerFormat

  isDebugMode: boolean
  isDatabaseDebugMode: boolean

  dbUrl: string

  telegramApiId?: string
  telegramApiHash?: string

  embeddingProvider?: EmbeddingProvider
  embeddingModel?: string
  embeddingDimension?: number
  embeddingApiKey?: string
  embeddingApiBase?: string
}

export const flags: RuntimeFlags = {
  logLevel: LoggerLevel.Verbose,
  logFormat: LoggerFormat.Pretty,

  isDebugMode: false,
  isDatabaseDebugMode: false,

  dbUrl: '',
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

export function parseEnvFlags(env: Record<string, string | undefined>): void {
  const logLevelValue = readEnvValue('LOG_LEVEL', env)
  if (logLevelValue) {
    const normalized = logLevelValue.toLowerCase()
    switch (normalized) {
      case 'debug':
        flags.logLevel = LoggerLevel.Debug
        flags.isDebugMode = true
        break
      case 'verbose':
        flags.logLevel = LoggerLevel.Verbose
        flags.isDebugMode = false
        break
    }
  }

  flags.isDatabaseDebugMode = readBooleanEnv('DATABASE_DEBUG', env)

  const dbUrlValue = readEnvValue('DATABASE_URL', env)
  if (dbUrlValue) {
    flags.dbUrl = dbUrlValue
  }

  const telegramId = readEnvValue('TELEGRAM_API_ID', env)
  if (telegramId) {
    flags.telegramApiId = telegramId
  }

  const telegramHash = readEnvValue('TELEGRAM_API_HASH', env)
  if (telegramHash) {
    flags.telegramApiHash = telegramHash
  }

  const embeddingProviderValue = readEnvValue('EMBEDDING_PROVIDER', env)
  if (embeddingProviderValue) {
    const normalized = embeddingProviderValue.toLowerCase()
    const provider = EMBEDDING_PROVIDER_ALIASES[normalized]
    if (provider) {
      flags.embeddingProvider = provider
    }
  }

  const embeddingModelValue = readEnvValue('EMBEDDING_MODEL', env)
  if (embeddingModelValue) {
    flags.embeddingModel = embeddingModelValue
  }

  const embeddingDimensionValue = readIntegerEnv('EMBEDDING_DIMENSION', env)
  if (
    typeof embeddingDimensionValue === 'number'
    && Object.values(EmbeddingDimension).includes(embeddingDimensionValue as EmbeddingDimension)
  ) {
    flags.embeddingDimension = embeddingDimensionValue
  }

  const embeddingKeyValue = readEnvValue('EMBEDDING_API_KEY', env)
  if (embeddingKeyValue) {
    flags.embeddingApiKey = embeddingKeyValue
  }

  const embeddingBaseValue = readEnvValue('EMBEDDING_BASE_URL', env)
  if (embeddingBaseValue) {
    flags.embeddingApiBase = embeddingBaseValue
  }
}
