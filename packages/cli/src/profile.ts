import process from 'node:process'

import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import envPaths from 'env-paths'

export interface ProfilePaths {
  root: string
  config: string
  session: string
  database: string
  exports: string
}

export interface ProfileConfig {
  apiId?: string
  apiHash?: string
  accountId?: string
}

const PROFILE_PATTERN = /^[\w.-]+$/
const DEFAULT_PATHS = envPaths('telegram-search', { suffix: '' })

export function profilesRoot(): string {
  return process.env.TG_SEARCH_HOME ?? DEFAULT_PATHS.data
}

export function resolveProfilePaths(name = 'default'): ProfilePaths {
  if (!PROFILE_PATTERN.test(name)) {
    throw new Error('Profile names may contain only letters, numbers, dot, underscore, and hyphen')
  }
  const root = join(profilesRoot(), 'profiles', name)
  return {
    root,
    config: join(root, 'config.json'),
    session: join(root, 'session'),
    database: join(root, 'pglite'),
    exports: join(root, 'exports'),
  }
}

export async function ensureProfile(name = 'default'): Promise<ProfilePaths> {
  const paths = resolveProfilePaths(name)
  await mkdir(paths.root, { recursive: true, mode: 0o700 })
  await mkdir(paths.exports, { recursive: true, mode: 0o700 })
  return paths
}

export async function listProfiles(): Promise<string[]> {
  try {
    const entries = await readdir(join(profilesRoot(), 'profiles'), { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return []
    throw error
  }
}

export async function readProfileConfig(paths: ProfilePaths): Promise<ProfileConfig> {
  try {
    return JSON.parse(await readFile(paths.config, 'utf8')) as ProfileConfig
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return {}
    throw error
  }
}

export async function writeProfileConfig(paths: ProfilePaths, config: ProfileConfig): Promise<void> {
  await writeFile(paths.config, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  await chmod(paths.config, 0o600)
}

export async function readSession(paths: ProfilePaths): Promise<string> {
  try {
    return (await readFile(paths.session, 'utf8')).trim()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return ''
    throw error
  }
}

export async function writeSession(paths: ProfilePaths, session: string): Promise<void> {
  await writeFile(paths.session, session, { mode: 0o600 })
  await chmod(paths.session, 0o600)
}
