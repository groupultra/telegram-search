import process from 'node:process'

import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import envPaths from 'env-paths'

import { writeFileAtomic } from './atomic-file'

export interface ProfilePaths {
  root: string
  config: string
  session: string
  /** OAuth tokens for the profile's remote server, mode 0600. */
  remoteToken: string
  database: string
  exports: string
  daemon: string
  daemonLock: string
  daemonStdoutLog: string
  daemonStderrLog: string
}

export interface ProfileConfig {
  remoteUrl?: string
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
    remoteToken: join(root, 'remote-token.json'),
    database: join(root, 'pglite'),
    exports: join(root, 'exports'),
    daemon: join(root, 'daemon.json'),
    daemonLock: join(root, 'daemon.lock'),
    daemonStdoutLog: join(root, 'daemon.stdout.log'),
    daemonStderrLog: join(root, 'daemon.stderr.log'),
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
  await writeFileAtomic(paths.config, `${JSON.stringify(config, null, 2)}\n`)
}

const configUpdates = new Map<string, Promise<unknown>>()

/**
 * Applies `update` to the config as it is on disk now, not to a snapshot read
 * earlier in the command. Updates in this process run one after another.
 */
export async function updateProfileConfig(paths: ProfilePaths, update: (latest: ProfileConfig) => ProfileConfig): Promise<ProfileConfig> {
  const run = (configUpdates.get(paths.config) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const next = update(await readProfileConfig(paths))
    await writeProfileConfig(paths, next)
    return next
  })
  configUpdates.set(paths.config, run)
  try {
    return await run
  }
  finally {
    if (configUpdates.get(paths.config) === run)
      configUpdates.delete(paths.config)
  }
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
  await writeFileAtomic(paths.session, session)
}
