import type { CoreConfig } from '../helper/config-schema'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import defu from 'defu'
import { safeParse } from 'valibot'
import { parse, stringify } from 'yaml'

import { coreConfigSchema } from '../helper/config-schema'
import { generateDefaultConfig } from '../helper/default-config'
import { useLogger } from '../helper/logger'

let config: CoreConfig

export function useConfigPath(): string {
  const configPath = join(homedir(), '.telegram-search', 'config.yaml')

  const defaultConfig = generateDefaultConfig()
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, stringify(defaultConfig))
  }

  return configPath
}

export function getSessionPath(storagePath: string) {
  return join(storagePath, 'sessions')
}

export function getMediaPath(storagePath: string) {
  return join(storagePath, 'media')
}

export function getDatabaseDSN(config: CoreConfig): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

function initConfig(): CoreConfig {
  const configPath = useConfigPath()
  const storagePath = join(homedir(), '.telegram-search')

  const configData = readFileSync(configPath, 'utf-8')
  const configParsedData = parse(configData)

  const mergedConfig = defu({}, configParsedData, generateDefaultConfig(storagePath))
  const validatedConfig = safeParse(coreConfigSchema, mergedConfig)

  if (!validatedConfig.success) {
    throw new Error('Failed to validate config')
  }

  validatedConfig.output.database.url = getDatabaseDSN(validatedConfig.output)

  config = validatedConfig.output

  useLogger('config').withFields(config).debug('Config loaded')
  return config
}

export function updateConfig(newConfig: Partial<CoreConfig>): CoreConfig {
  const configPath = useConfigPath()

  const mergedConfig = defu(config, newConfig)
  const validatedConfig = safeParse(coreConfigSchema, mergedConfig)

  if (!validatedConfig.success) {
    throw new Error('Failed to validate config')
  }

  writeFileSync(configPath, stringify(validatedConfig.output))

  config = validatedConfig.output
  return config
}

export function useConfig(): CoreConfig {
  if (!config) {
    config = initConfig()
  }

  return config
}
