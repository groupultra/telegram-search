import type { ProfilePaths } from './profile'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { acquireProfileLock, readLock } from './daemon/profile-state'
import { openLocalRuntime } from './local-runtime'
import { resolveProfilePaths } from './profile'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createPaths(): Promise<ProfilePaths> {
  const root = await mkdtemp(join(tmpdir(), 'tg-search-local-runtime-'))
  roots.push(root)
  return { ...resolveProfilePaths('test'), root, daemon: join(root, 'daemon.json'), daemonLock: join(root, 'daemon.lock') }
}

function options(timeoutMs: number) {
  return { remote: false, deadlineAt: Date.now() + timeoutMs, signal: new AbortController().signal }
}

describe('local runtime ownership', () => {
  it('never opens the profile database in two commands at once', async () => {
    // Cause: each command saw "no daemon" and opened PGlite itself; PGlite
    // supports a single process per data directory.
    const paths = await createPaths()
    let open = 0
    let maxOpen = 0
    const createCliRuntime = vi.fn(async () => {
      open += 1
      maxOpen = Math.max(maxOpen, open)
      return { close: async () => {
        open -= 1
      } }
    })
    const dependencies = { connectDaemon: async () => undefined, createCliRuntime } as never

    await Promise.all(Array.from({ length: 6 }, async () => {
      const runtime = await openLocalRuntime(paths, options(10_000), dependencies)
      await new Promise(resolve => setTimeout(resolve, 20))
      await runtime.close()
    }))

    expect(createCliRuntime).toHaveBeenCalledTimes(6)
    expect(maxOpen).toBe(1)
    await expect(readLock(paths)).resolves.toBeUndefined()
  })

  it('reports a retryable PROFILE_BUSY when another command keeps the database past the deadline', async () => {
    const paths = await createPaths()
    const release = await acquireProfileLock(paths, { role: 'cli', startedAt: 1 })
    const createCliRuntime = vi.fn()

    await expect(openLocalRuntime(paths, options(100), { connectDaemon: async () => undefined, createCliRuntime } as never))
      .rejects
      .toMatchObject({ appError: { code: 'PROFILE_BUSY', retryable: true } })
    expect(createCliRuntime).not.toHaveBeenCalled()
    await release()
  })

  it('connects to a daemon that took the lock after the first check', async () => {
    const paths = await createPaths()
    const release = await acquireProfileLock(paths, { role: 'daemon', startedAt: 1 })
    const daemon = { close: () => {} }
    const connectDaemon = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(daemon)
    const createCliRuntime = vi.fn()

    await expect(openLocalRuntime(paths, options(10_000), { connectDaemon, createCliRuntime } as never)).resolves.toBe(daemon)
    expect(createCliRuntime).not.toHaveBeenCalled()
    await release()
  })

  it('releases the lock when the direct runtime fails to start', async () => {
    const paths = await createPaths()
    const createCliRuntime = vi.fn(async () => {
      throw new Error('Telegram session is missing; run auth login first')
    })

    await expect(openLocalRuntime(paths, options(10_000), { connectDaemon: async () => undefined, createCliRuntime } as never)).rejects.toThrow('session is missing')
    await expect(readLock(paths)).resolves.toBeUndefined()
  })
})
