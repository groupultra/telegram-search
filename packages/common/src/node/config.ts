import type { Config } from '../browser/config-schema'

import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { useLogger } from '@unbird/logg'
import defu from 'defu'
import { join } from 'pathe'
import { safeParse } from 'valibot'
import { parse, stringify } from 'yaml'

import { configSchema } from '../browser/config-schema'
import { generateDefaultConfig } from '../browser/default-config'
import { resolveStoragePath, useAssetsPath, useConfigPath } from './path'

let config: Config
const logger = useLogger('common:config')

export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

export async function initConfig(): Promise<Config> {
  const configPath = await useConfigPath()
  const storagePath = resolveStoragePath(join(homedir(), '.telegram-search'))
  const assetsPath = await useAssetsPath()
  logger.withFields({ storagePath, assetsPath }).log('Storage path')

  const configData = readFileSync(configPath, 'utf-8')
  const configParsedData = parse(configData)

  const mergedConfig = defu({}, configParsedData, generateDefaultConfig({ storagePath, assetsPath }))
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  validatedConfig.output.database.url = getDatabaseDSN(validatedConfig.output)
  validatedConfig.output.path.storage = resolveStoragePath(validatedConfig.output.path.storage)

  config = validatedConfig.output

  logger.withFields(config).log('Config loaded')
  return config
}

export async function updateConfig(newConfig: Partial<Config>): Promise<Config> {
  const configPath = await useConfigPath()

  const mergedConfig = defu({}, newConfig, config)
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  validatedConfig.output.database.url = getDatabaseDSN(validatedConfig.output)
  validatedConfig.output.path.storage = resolveStoragePath(validatedConfig.output.path.storage)

  logger.withFields({ config: validatedConfig.output }).log('Updating config')
  writeFileSync(configPath, stringify(validatedConfig.output))

  config = validatedConfig.output
  return config
}

export function useConfig(): Config {
  if (!config) {
    logger.error('Config not initialized')
    throw new Error('Config not initialized')
  }

  return config
}
