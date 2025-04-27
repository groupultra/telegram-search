import type { Config } from '../helper/config-schema'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { cwd } from 'node:process'
import { findWorkspaceDir } from '@pnpm/find-workspace-dir'
import defu from 'defu'
import { safeParse } from 'valibot'
import { parse, stringify } from 'yaml'

import { configSchema } from '../helper/config-schema'
import { generateDefaultConfig } from '../helper/default-config'
import { useLogger } from '../helper/logger'

let config: Config
const logger = useLogger('common:config')

export async function useConfigPath(): Promise<string> {
  const workspaceDir = await findWorkspaceDir(cwd())
  if (!workspaceDir) {
    throw new Error('Failed to find workspace directory')
  }

  const configPath = resolve(workspaceDir, 'config', 'config.yaml')

  logger.withFields({ configPath }).debug('Config path')

  const defaultConfig = generateDefaultConfig()
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, stringify(defaultConfig))
  }

  return configPath
}

export function getSessionPath(storagePath: string) {
  const sessionPath = join(storagePath, 'sessions')
  if (!existsSync(sessionPath)) {
    mkdirSync(sessionPath, { recursive: true })
  }

  logger.withFields({ sessionPath }).debug('Session path')

  return sessionPath
}

export function getMediaPath(storagePath: string) {
  const mediaPath = join(storagePath, 'media')
  if (!existsSync(mediaPath)) {
    mkdirSync(mediaPath, { recursive: true })
  }

  logger.withFields({ mediaPath }).debug('Media path')
  return mediaPath
}

export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

export async function initConfig(): Promise<Config> {
  const configPath = await useConfigPath()
  const storagePath = join(homedir(), '.telegram-search')
  logger.withFields({ storagePath }).debug('Storage path')

  const configData = readFileSync(configPath, 'utf-8')
  const configParsedData = parse(configData)

  const mergedConfig = defu({}, configParsedData, generateDefaultConfig(storagePath))
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  validatedConfig.output.database.url = getDatabaseDSN(validatedConfig.output)

  config = validatedConfig.output

  logger.withFields(config).debug('Config loaded')
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

  logger.withFields({ config: validatedConfig.output }).debug('Updating config')
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
