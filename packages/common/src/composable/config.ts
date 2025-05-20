import type { Config } from '../helper/config-schema'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { cwd } from 'node:process'
import { findWorkspaceDir } from '@pnpm/find-workspace-dir'
import defu from 'defu'
import path from 'path-browserify-esm'
import { safeParse } from 'valibot'
import { parse, stringify } from 'yaml'

import { configSchema, DatabaseType } from '../helper/config-schema'
import { generateDefaultConfig } from '../helper/default-config'
import { useLogger } from '../helper/logger'

let config: Config
const logger = useLogger('common:config')

async function getWorkspacePath() {
  const workspaceDir = await findWorkspaceDir(cwd())
  if (!workspaceDir) {
    throw new Error('Failed to find workspace directory')
  }

  return workspaceDir
}

export async function useConfigPath(): Promise<string> {
  const configPath = resolve(await getWorkspacePath(), 'config', 'config.yaml')

  logger.withFields({ configPath }).log('Config path')

  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, stringify(generateDefaultConfig()))
  }

  return configPath
}

export async function getDrizzlePath(): Promise<string> {
  const workspaceDir = await getWorkspacePath()
  const drizzlePath = resolve(workspaceDir, 'drizzle')
  logger.withFields({ drizzlePath }).log('Drizzle migrations path')
  return drizzlePath
}

export async function useAssetsPath(): Promise<string> {
  const workspaceDir = await getWorkspacePath()
  const assetsPath = resolve(workspaceDir, 'assets')

  logger.withFields({ assetsPath }).log('Assets path')

  if (!existsSync(assetsPath)) {
    mkdirSync(dirname(assetsPath), { recursive: true })
  }

  return assetsPath
}

export function getSessionPath(storagePath: string) {
  const sessionPath = join(storagePath, 'sessions')
  if (!existsSync(sessionPath)) {
    mkdirSync(sessionPath, { recursive: true })
  }

  logger.withFields({ sessionPath }).log('Session path')

  return sessionPath
}

export function getMediaPath(storagePath: string) {
  const mediaPath = join(storagePath, 'media')
  if (!existsSync(mediaPath)) {
    mkdirSync(mediaPath, { recursive: true })
  }

  logger.withFields({ mediaPath }).log('Media path')
  return mediaPath
}

export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

export function getDatabaseFilePath(config: Config): string {
  const { database, path: configPath } = config

  let extension = ''
  switch (database.type) {
    case DatabaseType.PGLITE:
      extension = '.pglite'
      break
    default:
      return ''
  }

  return path.join(configPath.storage, `db${extension}`)
}

export function resolveStoragePath(path: string): string {
  if (path.startsWith('~')) {
    path = path.replace('~', homedir())
  }

  const resolvedPath = resolve(path)
  return resolvedPath
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
