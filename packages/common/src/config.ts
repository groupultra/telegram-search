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

  const runtimeConfig = applyRuntimeOverrides(validatedConfig.output)

  config = runtimeConfig

  logger.withFields(config).log('Config loaded')
  return config
}

function applyRuntimeOverrides(baseConfig: Config): Config {
  const runtimeConfig: Config = {
    ...baseConfig,
    database: {
      ...baseConfig.database,
    },
    api: baseConfig.api
      ? {
          ...baseConfig.api,
        }
      : undefined,
  }

  runtimeConfig.database.url = flags.dbUrl || runtimeConfig.database.url || getDatabaseDSN(runtimeConfig)

  if (flags.telegramApiId || flags.telegramApiHash) {
    runtimeConfig.api = runtimeConfig.api || {}
    const currentTelegram = runtimeConfig.api.telegram || {}
    runtimeConfig.api.telegram = {
      ...currentTelegram,
      apiId: flags.telegramApiId || currentTelegram.apiId,
      apiHash: flags.telegramApiHash || currentTelegram.apiHash,
    }
  }

  if (
    flags.embeddingProvider
    || typeof flags.embeddingModel === 'string'
    || typeof flags.embeddingDimension === 'number'
    || typeof flags.embeddingApiKey === 'string'
    || typeof flags.embeddingApiBase === 'string'
  ) {
    runtimeConfig.api = runtimeConfig.api || {}
    const currentEmbedding = runtimeConfig.api.embedding || {}
    runtimeConfig.api.embedding = {
      ...currentEmbedding,
      provider: flags.embeddingProvider || currentEmbedding.provider,
      model: flags.embeddingModel || currentEmbedding.model,
      dimension: flags.embeddingDimension || currentEmbedding.dimension,
      apiKey: flags.embeddingApiKey || currentEmbedding.apiKey,
      apiBase: flags.embeddingApiBase || currentEmbedding.apiBase,
    }
  }

  return runtimeConfig
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
