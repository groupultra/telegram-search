import type { Config } from '../browser'

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { cwd } from 'node:process'

import { findWorkspaceDir } from '@pnpm/find-workspace-dir'
import { useLogger } from '@tg-search/logg'
import { dirname, join, resolve } from 'pathe'

import { DatabaseType, generateDefaultConfig } from '../browser'

const logger = useLogger()

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

  return join(configPath.storage, `db${extension}`)
}

export function resolveStoragePath(path: string): string {
  if (path.startsWith('~')) {
    path = path.replace('~', homedir())
  }

  const resolvedPath = resolve(path)
  return resolvedPath
}

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
    writeFileSync(configPath, JSON.stringify(generateDefaultConfig()))
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
