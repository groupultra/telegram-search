import type { Config } from './config-schema'
import type { RuntimeFlags } from './flags'

import { useLogger } from '@unbird/logg'
import { isBrowser } from '@unbird/logg/utils'
import { useLocalStorage } from '@vueuse/core'
import defu from 'defu'
import { safeParse } from 'valibot'

import { configSchema, generateDefaultConfig } from './config-schema'

let config: Config
const logger = useLogger('common:config')
const CONFIG_STORAGE_KEY = 'settings/config'

export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

function validateAndMergeConfig(newConfig: Partial<Config>, baseConfig?: Config): Config {
  const mergedConfig = defu({}, newConfig, baseConfig || generateDefaultConfig())
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  return validatedConfig.output
}

function applyTelegramOverrides(config: Config, flags?: RuntimeFlags): void {
  if (flags?.telegramApiId || flags?.telegramApiHash) {
    config.api = config.api || {}
    const currentTelegram = config.api.telegram || {}
    config.api.telegram = {
      ...currentTelegram,
      ...(flags.telegramApiId && { apiId: flags.telegramApiId }),
      ...(flags.telegramApiHash && { apiHash: flags.telegramApiHash }),
    }
  }
}

function applyEmbeddingOverrides(config: Config, flags?: RuntimeFlags): void {
  if (
    flags?.embeddingProvider
    || flags?.embeddingModel
    || flags?.embeddingDimension
    || flags?.embeddingApiKey
    || flags?.embeddingApiBase
  ) {
    config.api = config.api || {}
    const currentEmbedding = config.api.embedding || {}
    config.api.embedding = {
      ...currentEmbedding,
      ...(flags.embeddingProvider && { provider: flags.embeddingProvider }),
      ...(flags.embeddingModel && { model: flags.embeddingModel }),
      ...(flags.embeddingDimension && { dimension: flags.embeddingDimension }),
      ...(flags.embeddingApiKey && { apiKey: flags.embeddingApiKey }),
      ...(flags.embeddingApiBase && { apiBase: flags.embeddingApiBase }),
    }
  }
}

export async function initConfig(flags?: RuntimeFlags) {
  if (isBrowser()) {
    const configStorage = useLocalStorage(CONFIG_STORAGE_KEY, generateDefaultConfig())

    const savedConfig = configStorage.value
    if (savedConfig) {
      try {
        config = validateAndMergeConfig(savedConfig)
        return config
      }
      catch {}
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

  const validatedConfig = validateAndMergeConfig(configParsedData)
  const runtimeConfig = applyRuntimeOverrides(validatedConfig, flags)

  config = runtimeConfig

  logger.withFields(config).log('Config loaded')
  return config
}

function applyRuntimeOverrides(baseConfig: Config, flags?: RuntimeFlags): Config {
  const runtimeConfig: Config = {
    ...baseConfig,
    database: { ...baseConfig.database },
  }

  if (baseConfig.api) {
    runtimeConfig.api = { ...baseConfig.api }
  }

  // Apply database URL override
  runtimeConfig.database.type = flags?.dbProvider || runtimeConfig.database.type
  runtimeConfig.database.url = flags?.dbUrl || runtimeConfig.database.url || getDatabaseDSN(runtimeConfig)

  // Apply API overrides
  applyTelegramOverrides(runtimeConfig, flags)
  applyEmbeddingOverrides(runtimeConfig, flags)

  return runtimeConfig
}

export async function updateConfig(newConfig: Partial<Config>) {
  if (isBrowser()) {
    const configStorage = useLocalStorage(CONFIG_STORAGE_KEY, generateDefaultConfig())

    const validatedConfig = validateAndMergeConfig(newConfig, config)

    logger.withFields({ config: validatedConfig }).log('Updating config')

    config = validatedConfig
    configStorage.value = config

    return config
  }

  const { useConfigPath } = await import('./node/path')
  const { writeFileSync } = await import('node:fs')
  const { stringify } = await import('yaml')

  const configPath = await useConfigPath()

  const validatedConfig = validateAndMergeConfig(newConfig, config)
  validatedConfig.database.url = getDatabaseDSN(validatedConfig)

  logger.withFields({ config: validatedConfig }).log('Updating config')
  writeFileSync(configPath, stringify(validatedConfig))

  config = validatedConfig
  return config
}

export function useConfig(): Config {
  if (!config) {
    throw new Error('Config not initialized')
  }

  return config
}
