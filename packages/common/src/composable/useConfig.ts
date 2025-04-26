import type { CoreConfig } from '../types/config'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import defu from 'defu'
import { safeParse } from 'valibot'
import { parse, stringify } from 'yaml'

import { coreConfigSchema } from '../types/config'
import { usePaths } from './usePath'

let config: CoreConfig

export function generateDefaultConfig(): CoreConfig {
  const storageDir = join(homedir(), '.telegram-search')

  const defaultConfig = safeParse(coreConfigSchema, {
    path: {
      storage: storageDir,
    },
  })

  if (!defaultConfig.success) {
    throw new Error('Failed to generate default config')
  }

  return defaultConfig.output
}

export function getDatabaseDSN(config: CoreConfig): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

function initConfig(): CoreConfig {
  const { configPath } = usePaths()

  const defaultConfig = generateDefaultConfig()
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, stringify(defaultConfig))
  }

  const configData = readFileSync(configPath, 'utf-8')
  const configParsedData = parse(configData)

  const mergedConfig = defu({}, configParsedData, defaultConfig)
  const validatedConfig = safeParse(coreConfigSchema, mergedConfig)

  if (!validatedConfig.success) {
    throw new Error('Failed to validate config')
  }

  validatedConfig.output.database.url = getDatabaseDSN(validatedConfig.output)

  config = validatedConfig.output
  return config
}

export function updateConfig(newConfig: Partial<CoreConfig>): CoreConfig {
  const { configPath } = usePaths()

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
