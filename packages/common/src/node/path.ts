import type { Config } from '../config-schema'

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { useLogger } from '@unbird/logg'
import { dirname, resolve } from 'pathe'

import { DatabaseType, generateDefaultConfig } from '../config-schema'

const logger = useLogger()

export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

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

export async function useConfigPath(): Promise<string> {
  const configPath = resolve(getRootPath(), './config', 'config.yaml')

  logger.withFields({ configPath }).log('Config path')

  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify(generateDefaultConfig()))
  }

  return configPath
}

export function getSessionPath(): string {
  const sessionPath = resolve(getDataPath(), 'sessions')
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true })
  }

  logger.withFields({ sessionPath }).log('Session path')

  return sessionPath
}
