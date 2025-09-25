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

interface EnvParser {
  readonly keys: ReadonlyArray<string>
  readonly parse: (value: string) => void
}

const embeddingProvidersByName: Record<string, EmbeddingProvider> = {
  [EmbeddingProvider.OPENAI]: EmbeddingProvider.OPENAI,
  [EmbeddingProvider.OLLAMA]: EmbeddingProvider.OLLAMA,
}

const envParsers: ReadonlyArray<EnvParser> = [
  {
    keys: ['log_level'],
    parse(value: string) {
      const normalizedValue = value.trim().toLowerCase()
      switch (normalizedValue) {
        case 'debug':
          flags.logLevel = LoggerLevel.Debug
          flags.isDebugMode = true
          break
        case 'verbose':
          flags.logLevel = LoggerLevel.Verbose
          break
      }
    },
  },
  {
    keys: ['database_debug'],
    parse(value: string) {
      flags.isDatabaseDebugMode = value.trim().toLowerCase() === 'true'
    },
  },
  {
    keys: ['database_url'],
    parse(value: string) {
      flags.dbUrl = value
    },
  },
  {
    keys: ['telegram_api_id', 'tg_api_id'],
    parse(value: string) {
      flags.telegramApiId = value
    },
  },
  {
    keys: ['telegram_api_hash', 'tg_api_hash', 'tg_api_key', 'telegram_api_key'],
    parse(value: string) {
      flags.telegramApiHash = value
    },
  },
  {
    keys: ['embedding_provider'],
    parse(value: string) {
      const normalizedValue = value.trim().toLowerCase()
      const provider = embeddingProvidersByName[normalizedValue]
      if (provider) {
        flags.embeddingProvider = provider
      }
    },
  },
  {
    keys: ['embedding_model'],
    parse(value: string) {
      flags.embeddingModel = value
    },
  },
  {
    keys: ['embedding_dimension'],
    parse(value: string) {
      const parsed = Number.parseInt(value, 10)
      if (Number.isInteger(parsed) && Object.values(EmbeddingDimension).includes(parsed as EmbeddingDimension)) {
        flags.embeddingDimension = parsed
      }
    },
  },
  {
    keys: ['embedding_api_key', 'embedding_key'],
    parse(value: string) {
      flags.embeddingApiKey = value
    },
  },
  {
    keys: ['embedding_api_base', 'embedding_base_url', 'embedding_baseurl', 'embedding_base', 'baseurl', 'base_url'],
    parse(value: string) {
      flags.embeddingApiBase = value
    },
  },
]

export function parseEnvFlags(env: Record<string, string>) {
  const normalizedEnv = new Map<string, string>()

  for (const [key, value] of Object.entries(env)) {
    normalizedEnv.set(key.toLowerCase(), value)
  }

  for (const parser of envParsers) {
    for (const key of parser.keys) {
      const rawValue = normalizedEnv.get(key)

      if (typeof rawValue === 'undefined') {
        continue
      }

      parser.parse(rawValue)
      break
    }
  }

  // eslint-disable-next-line no-console
  console.log('Flags parsed', flags)
}
