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

const TELEGRAM_ID_KEYS: ReadonlyArray<string> = ['TELEGRAM_API_ID', 'TG_API_ID']
const TELEGRAM_HASH_KEYS: ReadonlyArray<string> = ['TELEGRAM_API_HASH', 'TG_API_HASH', 'TG_API_KEY', 'TELEGRAM_API_KEY']
const EMBEDDING_PROVIDER_KEYS: ReadonlyArray<string> = ['EMBEDDING_PROVIDER']
const EMBEDDING_MODEL_KEYS: ReadonlyArray<string> = ['EMBEDDING_MODEL']
const EMBEDDING_DIMENSION_KEYS: ReadonlyArray<string> = ['EMBEDDING_DIMENSION']
const EMBEDDING_KEY_KEYS: ReadonlyArray<string> = ['EMBEDDING_API_KEY', 'EMBEDDING_KEY']
const EMBEDDING_BASE_KEYS: ReadonlyArray<string> = [
  'EMBEDDING_API_BASE',
  'EMBEDDING_BASE_URL',
  'EMBEDDING_BASEURL',
  'EMBEDDING_BASE',
  'BASEURL',
  'BASE_URL',
]

function readEnvValue(keys: ReadonlyArray<string>, env: Record<string, string | undefined>): string | undefined {
  for (const key of keys) {
    const value = env[key] ?? env[key.toLowerCase()] ?? env[key.toUpperCase()]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }

  return undefined
}

function readBooleanEnv(key: string, env: Record<string, string | undefined>): boolean {
  const value = readEnvValue([key], env)
  return value ? TRUE_VALUES.has(value.toLowerCase()) : false
}

function readIntegerEnv(keys: ReadonlyArray<string>, env: Record<string, string | undefined>): number | undefined {
  const rawValue = readEnvValue(keys, env)
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
  const logLevelValue = readEnvValue(['LOG_LEVEL'], env)
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

  const dbUrlValue = readEnvValue(['DATABASE_URL'], env)
  if (dbUrlValue) {
    flags.dbUrl = dbUrlValue
  }

  const telegramId = readEnvValue(TELEGRAM_ID_KEYS, env)
  if (telegramId) {
    flags.telegramApiId = telegramId
  }

  const telegramHash = readEnvValue(TELEGRAM_HASH_KEYS, env)
  if (telegramHash) {
    flags.telegramApiHash = telegramHash
  }

  const embeddingProviderValue = readEnvValue(EMBEDDING_PROVIDER_KEYS, env)
  if (embeddingProviderValue) {
    const normalized = embeddingProviderValue.toLowerCase()
    const provider = EMBEDDING_PROVIDER_ALIASES[normalized]
    if (provider) {
      flags.embeddingProvider = provider
    }
  }

  const embeddingModelValue = readEnvValue(EMBEDDING_MODEL_KEYS, env)
  if (embeddingModelValue) {
    flags.embeddingModel = embeddingModelValue
  }

  const embeddingDimensionValue = readIntegerEnv(EMBEDDING_DIMENSION_KEYS, env)
  if (
    typeof embeddingDimensionValue === 'number'
    && Object.values(EmbeddingDimension).includes(embeddingDimensionValue as EmbeddingDimension)
  ) {
    flags.embeddingDimension = embeddingDimensionValue
  }

  const embeddingKeyValue = readEnvValue(EMBEDDING_KEY_KEYS, env)
  if (embeddingKeyValue) {
    flags.embeddingApiKey = embeddingKeyValue
  }

  const embeddingBaseValue = readEnvValue(EMBEDDING_BASE_KEYS, env)
  if (embeddingBaseValue) {
    flags.embeddingApiBase = embeddingBaseValue
  }
}
