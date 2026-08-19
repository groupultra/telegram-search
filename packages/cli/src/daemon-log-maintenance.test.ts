import type { ProfilePaths } from './profile'

import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { maintainDaemonLogs } from './daemon-log-maintenance'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function createPaths(): Promise<ProfilePaths> {
  const root = await mkdtemp(join(tmpdir(), 'tg-search-daemon-logs-'))
  directories.push(root)
  return {
    root,
    config: join(root, 'config.json'),
    session: join(root, 'session'),
    database: join(root, 'pglite'),
    exports: join(root, 'exports'),
    daemon: join(root, 'daemon.json'),
    daemonLock: join(root, 'daemon.lock'),
    daemonStdoutLog: join(root, 'daemon.stdout.log'),
    daemonStderrLog: join(root, 'daemon.stderr.log'),
  }
}

describe('daemon log maintenance', () => {
  it('rotates yesterday\'s active log and removes expired archives', async () => {
    const paths = await createPaths()
    const now = new Date('2026-08-20T02:00:00+08:00')
    const yesterday = new Date('2026-08-19T02:00:00+08:00')
    const expired = new Date('2026-08-01T02:00:00+08:00')
    const expiredArchive = `${paths.daemonStdoutLog}.2026-08-01`

    await writeFile(paths.daemonStdoutLog, 'yesterday\n')
    await utimes(paths.daemonStdoutLog, yesterday, yesterday)
    await writeFile(expiredArchive, 'expired\n')
    await utimes(expiredArchive, expired, expired)

    await maintainDaemonLogs(paths, now, 14)

    await expect(readFile(`${paths.daemonStdoutLog}.2026-08-19`, 'utf8')).resolves.toBe('yesterday\n')
    await expect(readFile(paths.daemonStdoutLog, 'utf8')).resolves.toBe('')
    await expect(readFile(expiredArchive, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
