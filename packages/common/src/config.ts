import type { Config } from './config-schema'

import { useLogger } from '@unbird/logg'
import { isBrowser } from '@unbird/logg/utils'
import { useLocalStorage } from '@vueuse/core'
import defu from 'defu'
import { safeParse } from 'valibot'

import { configSchema, generateDefaultConfig } from './config-schema'
import { flags } from './flags'

let config: Config
const logger = useLogger('common:config')
const CONFIG_STORAGE_KEY = 'settings/config'

export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

export async function initConfig() {
  if (isBrowser()) {
    const configStorage = useLocalStorage(CONFIG_STORAGE_KEY, generateDefaultConfig())

    const savedConfig = configStorage.value
    if (savedConfig) {
      const validatedConfig = safeParse(configSchema, savedConfig)
      if (validatedConfig.success) {
        config = validatedConfig.output
        return config
      }
    }

    config = generateDefaultConfig()
    return config
  }

  const { useConfigPath } = await import('./node/path')
  const { readFileSync } = await import('node:fs')
  const { parse } = await import('yaml')

  const configPath = await useConfigPath()

  const configData = readFileSync(configPath, 'utf-8')
  const configParsedData = parse(configData)

  const mergedConfig = defu({}, configParsedData, generateDefaultConfig())
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  const runtimeOverrides = buildRuntimeOverrides(validatedConfig.output)
  const runtimeConfig = defu(runtimeOverrides, validatedConfig.output) as Config

  config = runtimeConfig

  logger.withFields(config).log('Config loaded')
  return config
}

type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? PartialDeep<T[K]> : T[K]
}

function buildRuntimeOverrides(baseConfig: Config): PartialDeep<Config> {
  const overrides: PartialDeep<Config> = {
    database: {
      url: flags.dbUrl || getDatabaseDSN(baseConfig),
    },
  }

  const ensureApiOverrides = (): NonNullable<PartialDeep<Config>['api']> => {
    if (!overrides.api) {
      overrides.api = {}
    }

    return overrides.api as NonNullable<PartialDeep<Config>['api']>
  }

  if (
    typeof flags.telegramApiId === 'string'
    || typeof flags.telegramApiHash === 'string'
  ) {
    const apiOverrides = ensureApiOverrides()
    const telegramOverrides: NonNullable<typeof apiOverrides['telegram']> = {}

    if (typeof flags.telegramApiId === 'string') {
      telegramOverrides.apiId = flags.telegramApiId
    }

    if (typeof flags.telegramApiHash === 'string') {
      telegramOverrides.apiHash = flags.telegramApiHash
    }

    apiOverrides.telegram = telegramOverrides
  }

  if (
    flags.embeddingProvider
    || typeof flags.embeddingModel === 'string'
    || typeof flags.embeddingDimension === 'number'
    || typeof flags.embeddingApiKey === 'string'
    || typeof flags.embeddingApiBase === 'string'
  ) {
    const apiOverrides = ensureApiOverrides()
    const embeddingOverrides: NonNullable<typeof apiOverrides['embedding']> = {}

    if (flags.embeddingProvider) {
      embeddingOverrides.provider = flags.embeddingProvider
    }

    if (typeof flags.embeddingModel === 'string') {
      embeddingOverrides.model = flags.embeddingModel
    }

    if (typeof flags.embeddingDimension === 'number') {
      embeddingOverrides.dimension = flags.embeddingDimension
    }

    if (typeof flags.embeddingApiKey === 'string') {
      embeddingOverrides.apiKey = flags.embeddingApiKey
    }

    if (typeof flags.embeddingApiBase === 'string') {
      embeddingOverrides.apiBase = flags.embeddingApiBase
    }

    apiOverrides.embedding = embeddingOverrides
  }

  return overrides
}

export async function updateConfig(newConfig: Partial<Config>) {
  if (isBrowser()) {
    const configStorage = useLocalStorage(CONFIG_STORAGE_KEY, generateDefaultConfig())

    const mergedConfig = defu({}, newConfig, config)
    const validatedConfig = safeParse(configSchema, mergedConfig)

    if (!validatedConfig.success) {
      logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
      throw new Error('Failed to validate config')
    }

    logger.withFields({ config: validatedConfig.output }).log('Updating config')

    config = validatedConfig.output

    configStorage.value = config

    return config
  }

  const { useConfigPath } = await import('./node/path')
  const { writeFileSync } = await import('node:fs')
  const { stringify } = await import('yaml')

  const configPath = await useConfigPath()

  const mergedConfig = defu({}, newConfig, config)
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  validatedConfig.output.database.url = getDatabaseDSN(validatedConfig.output)

  logger.withFields({ config: validatedConfig.output }).log('Updating config')
  writeFileSync(configPath, stringify(validatedConfig.output))

  config = validatedConfig.output
  return config
}

export function useConfig(): Config {
  if (!config) {
    throw new Error('Config not initialized')
  }

  return config
}
