import type { Config } from '../config-schema'

import fs from 'node:fs'
import process from 'node:process'

import { useLogger } from '@guiiai/logg'
import { dirname, resolve } from 'pathe'

import { DatabaseType } from '../config-schema'

const logger = useLogger()

// Find project root by looking for pnpm-workspace.yaml
function findProjectRoot(): string {
  let currentDir = process.cwd()
  const root = '/'

  // Keep going up until we find pnpm-workspace.yaml or reach root
  while (currentDir !== root) {
    const workspaceFile = resolve(currentDir, 'pnpm-workspace.yaml')
    if (fs.existsSync(workspaceFile)) {
      return currentDir
    }
    currentDir = dirname(currentDir)
  }

  // Fallback: if not found, use cwd (should not happen in normal usage)
  logger.warn('pnpm-workspace.yaml not found, using current directory as root')
  return process.cwd()
}

export const ROOT_DIR = findProjectRoot()

export function getRootPath(): string {
  return ROOT_DIR
}

export function getDataPath(): string {
  return resolve(ROOT_DIR, './data')
}

export function getDatabaseFilePath(config: Config): string {
  const { database } = config

  let extension = ''
  switch (database.type) {
    case DatabaseType.PGLITE:
      extension = '.pglite'
      break
    default:
      return ''
  }

  return resolve(getDataPath(), `db${extension}`)
}
