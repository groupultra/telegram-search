import type { Logger } from '@guiiai/logg'

import type { ProfilePaths } from './profile'

import process from 'node:process'

import { appendFile, chmod, readdir, readFile, stat, truncate, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

const DAY_MS = 24 * 60 * 60 * 1000
const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000
const DEFAULT_RETENTION_DAYS = 14

function localDateKey(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function retentionDays(env = process.env): number {
  const value = Number.parseInt(env.TG_SEARCH_DAEMON_LOG_RETENTION_DAYS ?? '', 10)
  return Number.isSafeInteger(value) && value >= 1 ? value : DEFAULT_RETENTION_DAYS
}

function daemonLogPaths(paths: ProfilePaths): string[] {
  return [paths.daemonStdoutLog, paths.daemonStderrLog]
}

function rotationStatePath(path: string): string {
  return `${path}.rotation-state.json`
}

async function readActiveDate(path: string, fallback: string): Promise<string> {
  try {
    const parsed = JSON.parse(await readFile(rotationStatePath(path), 'utf8')) as { activeDate?: unknown }
    return typeof parsed.activeDate === 'string' ? parsed.activeDate : fallback
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError)
      return fallback
    throw error
  }
}

async function writeActiveDate(path: string, activeDate: string): Promise<void> {
  const statePath = rotationStatePath(path)
  await writeFile(statePath, `${JSON.stringify({ activeDate })}\n`, { mode: 0o600 })
  await chmod(statePath, 0o600)
}

async function rotateLog(path: string, now: Date): Promise<void> {
  let details: Awaited<ReturnType<typeof stat>>
  try {
    details = await stat(path)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return
    throw error
  }

  const today = localDateKey(now)
  const sourceDate = await readActiveDate(path, localDateKey(details.mtime))
  if (sourceDate === today) {
    await writeActiveDate(path, today)
    return
  }

  if (details.size === 0) {
    await writeActiveDate(path, today)
    return
  }

  // launchd keeps the stdout/stderr file descriptor open, so rename-based
  // rotation would keep future output in the archived file. Copy then truncate
  // keeps the active inode in place for launchd and other supervisors.
  const archive = `${path}.${sourceDate}`
  const contents = await readFile(path)
  if (contents.length === 0)
    return

  await appendFile(archive, contents, { mode: 0o600 })
  await chmod(archive, 0o600)
  await truncate(path, 0)
  await writeActiveDate(path, today)
}

async function pruneArchives(path: string, now: Date, days: number): Promise<void> {
  const directory = dirname(path)
  const prefix = `${basename(path)}.`
  const expiresBefore = now.getTime() - days * DAY_MS
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(entries
    .filter(entry => entry.isFile() && entry.name.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}$/.test(entry.name.slice(prefix.length)))
    .map(async (entry) => {
      const archive = join(directory, entry.name)
      const details = await stat(archive)
      if (details.mtimeMs < expiresBefore)
        await unlink(archive)
    }))
}

export async function maintainDaemonLogs(paths: ProfilePaths, now = new Date(), days = retentionDays()): Promise<void> {
  for (const path of daemonLogPaths(paths)) {
    await rotateLog(path, now)
    await pruneArchives(path, now, days)
  }
}

export async function startDaemonLogMaintenance(paths: ProfilePaths, logger: Logger): Promise<() => void> {
  await maintainDaemonLogs(paths)
  const timer = setInterval(() => {
    void maintainDaemonLogs(paths).catch(error => logger.withError(error).warn('Failed to maintain daemon logs'))
  }, MAINTENANCE_INTERVAL_MS)
  timer.unref()
  return () => clearInterval(timer)
}
