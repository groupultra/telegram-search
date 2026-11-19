import type { ProfilePaths } from '../profile'

import process from 'node:process'

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveProfilePaths } from '../profile'
import { connectDaemon } from './client'
import { acquireProfileLock, ProfileLockedError, readLock, waitForProfileLockRelease } from './profile-state'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createPaths(): Promise<ProfilePaths> {
  const root = await mkdtemp(join(tmpdir(), 'tg-search-profile-lock-'))
  roots.push(root)
  return { ...resolveProfilePaths('test'), root, daemon: join(root, 'daemon.json'), daemonLock: join(root, 'daemon.lock') }
}

// PID 2^22 + 1 is above the Linux and macOS PID limits, so no process owns it.
const DEAD_PID = 4_194_305

describe('profile lock', () => {
  it('lets exactly one of several starters take over a stale lock', async () => {
    // Cause: every starter read the stale lock, then unlinked whatever was at
    // the path. A slower starter deleted the winner's fresh lock and acquired
    // too, so two daemons opened one PGlite directory.
    for (let round = 0; round < 20; round++) {
      const paths = await createPaths()
      await writeFile(paths.daemonLock, `${JSON.stringify({ pid: DEAD_PID, startedAt: 1 })}\n`)

      const results = await Promise.allSettled(Array.from({ length: 8 }, () => acquireProfileLock(paths, { role: 'daemon', startedAt: Date.now() })))

      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      for (const result of results) {
        if (result.status === 'rejected')
          expect(result.reason).toBeInstanceOf(ProfileLockedError)
      }
      await expect(readLock(paths)).resolves.toMatchObject({ pid: process.pid, role: 'daemon' })
      // No temporary or claimed files stay behind.
      expect(await readdir(paths.root)).toEqual(['daemon.lock'])
    }
  })

  it('replaces an unreadable lock file', async () => {
    const paths = await createPaths()
    await writeFile(paths.daemonLock, '')

    const release = await acquireProfileLock(paths, { role: 'daemon', startedAt: 1 })

    await expect(readLock(paths)).resolves.toMatchObject({ pid: process.pid })
    await release()
    await expect(readLock(paths)).resolves.toBeUndefined()
  })

  it('does not release a lock that another process holds now', async () => {
    const paths = await createPaths()
    const release = await acquireProfileLock(paths, { role: 'daemon', startedAt: 1 })
    const foreign = `${JSON.stringify({ pid: process.pid, startedAt: 2, role: 'daemon' })}\n`
    await writeFile(paths.daemonLock, foreign)

    await release()

    await expect(readFile(paths.daemonLock, 'utf8')).resolves.toBe(foreign)
  })

  it('waits for a one-shot command to release the lock, and fails at once for a daemon', async () => {
    const paths = await createPaths()
    const releaseCli = await acquireProfileLock(paths, { role: 'cli', startedAt: 1 })

    await expect(acquireProfileLock(paths, { role: 'cli', startedAt: 2 })).rejects.toMatchObject({ owner: { role: 'cli' } })
    await expect(acquireProfileLock(paths, { role: 'cli', startedAt: 2, wait: { deadlineAt: Date.now() + 100 } })).rejects.toBeInstanceOf(ProfileLockedError)

    const waiting = acquireProfileLock(paths, { role: 'daemon', startedAt: 3, wait: { deadlineAt: Date.now() + 10_000 } })
    await releaseCli()
    const releaseDaemon = await waiting

    const startedWaitingAt = Date.now()
    await expect(acquireProfileLock(paths, { role: 'cli', startedAt: 4, wait: { deadlineAt: Date.now() + 10_000 } })).rejects.toMatchObject({ owner: { role: 'daemon' } })
    expect(Date.now() - startedWaitingAt).toBeLessThan(5_000)
    await releaseDaemon()
  })

  it('stops waiting when the caller aborts', async () => {
    const paths = await createPaths()
    const release = await acquireProfileLock(paths, { role: 'cli', startedAt: 1 })
    const controller = new AbortController()

    const waiting = acquireProfileLock(paths, { role: 'cli', startedAt: 2, wait: { deadlineAt: Date.now() + 10_000, signal: controller.signal } })
    controller.abort(new Error('cancelled'))

    await expect(waiting).rejects.toThrow('cancelled')
    await release()
    expect(await readdir(paths.root)).toEqual([])
  })

  it('does not treat a one-shot command lock as a starting daemon', async () => {
    // A client used to poll for a daemon descriptor for 30 seconds and then fail.
    const paths = await createPaths()
    const release = await acquireProfileLock(paths, { role: 'cli', startedAt: 1 })

    await expect(connectDaemon(paths)).resolves.toBeUndefined()
    await release()
  })

  it('reports when the previous owner released the lock', async () => {
    const paths = await createPaths()
    const release = await acquireProfileLock(paths, { role: 'daemon', startedAt: 1 })

    await expect(waitForProfileLockRelease(paths, process.pid, 100)).resolves.toBe(false)
    const released = waitForProfileLockRelease(paths, process.pid, 10_000)
    await release()
    await expect(released).resolves.toBe(true)
  })
})
