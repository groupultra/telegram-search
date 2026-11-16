import type { ProfilePaths } from '../profile'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CoreEventType } from '@tg-search/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveProfilePaths, writeSession } from '../profile'
import { connectDaemon } from './client'
import { createDaemonHost } from './host'
import { readDescriptor, readLock } from './profile-state'

const core = vi.hoisted(() => ({
  /** When false, the fake Telegram runtime never reports AccountReady. */
  answerLogin: true,
  contexts: [] as Array<{ emitter: import('node:events').EventEmitter }>,
}))

vi.mock('@tg-search/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tg-search/core')>()
  const { EventEmitter } = await import('node:events')
  return {
    ...actual,
    initDrizzle: vi.fn(async () => ({ db: {}, pglite: { close: async () => {} } })),
    createDatabaseAdministration: vi.fn(() => ({})),
    createTelegramApplicationRuntime: vi.fn(() => ({ dispose: async () => {} })),
    destroyCoreInstance: vi.fn(async () => {}),
    createCoreInstance: vi.fn(() => {
      const emitter = new EventEmitter()
      emitter.on(actual.CoreEventType.AuthLogin, () => {
        if (core.answerLogin)
          setTimeout(() => emitter.emit(actual.CoreEventType.AccountReady, { accountId: 'account-1' }), 5)
      })
      const context = {
        emitter,
        setCurrentAccountId: () => {},
        getClient: () => ({ session: { save: () => 'session-of-running-client' } }),
      }
      core.contexts.push(context)
      return context
    }),
  }
})

const roots: string[] = []
const hosts: Array<Awaited<ReturnType<typeof createDaemonHost>>> = []

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stop()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  core.answerLogin = true
  core.contexts.length = 0
})

async function createPaths(): Promise<ProfilePaths> {
  const root = await mkdtemp(join(tmpdir(), 'tg-search-daemon-host-'))
  roots.push(root)
  return {
    ...resolveProfilePaths('test'),
    root,
    config: join(root, 'config.json'),
    session: join(root, 'session'),
    database: join(root, 'pglite'),
    daemon: join(root, 'daemon.json'),
    daemonLock: join(root, 'daemon.lock'),
    daemonStdoutLog: join(root, 'daemon.stdout.log'),
    daemonStderrLog: join(root, 'daemon.stderr.log'),
  }
}

async function startHost(paths: ProfilePaths, options?: { signal?: AbortSignal }) {
  const host = await createDaemonHost(paths, 'test', options)
  hosts.push(host)
  return host
}

describe('daemon host', () => {
  it('releases the lock when a stop signal arrives during startup', async () => {
    // Cause: signal handlers were installed only after startup, which waits up
    // to a minute for Telegram; SIGTERM in that window killed the process with
    // the lock and the database still held.
    const paths = await createPaths()
    await writeSession(paths, 'saved-session')
    core.answerLogin = false
    const controller = new AbortController()

    const starting = startHost(paths, { signal: controller.signal })
    await vi.waitFor(() => expect(core.contexts[0]?.emitter.listenerCount(CoreEventType.AccountReady)).toBe(1))
    controller.abort()
    const host = await starting

    await host.wait()
    expect(host.status().state).toBe('stopping')
    await expect(readLock(paths)).resolves.toBeUndefined()
    await expect(readDescriptor(paths)).resolves.toBeUndefined()
  })

  it('leaves the running daemon untouched when a second daemon fails to start', async () => {
    const paths = await createPaths()
    const first = await startHost(paths)

    await expect(createDaemonHost(paths, 'test')).rejects.toThrow('Daemon already running')

    const client = await connectDaemon(paths)
    expect(client).toBeDefined()
    client?.close()
    expect(first.status().state).toBe('unauthorized')
  })

  it('rebuilds the runtime for a recovery requested during a reload', async () => {
    // Cause: reload and recover shared one in-flight promise, so a recovery
    // requested during a reload returned the reload result and rebuilt nothing.
    const paths = await createPaths()
    await writeSession(paths, 'saved-session')
    const host = await startHost(paths)
    expect(host.status()).toMatchObject({ state: 'ready', accountId: 'account-1' })
    expect(core.contexts).toHaveLength(1)

    const [reloaded, recovered] = await Promise.all([host.reload(), host.recover()])

    expect(reloaded.state).toBe('ready')
    expect(recovered).toMatchObject({ state: 'ready', health: { recovery: { attempts: 1, inProgress: false } } })
    expect(core.contexts).toHaveLength(3)
  })

  it('reads the session again for a reload requested while another reload runs', async () => {
    // Cause: the second request got the first reload's promise, which had read
    // the session file before `auth login` replaced it.
    const paths = await createPaths()
    const host = await startHost(paths)
    expect(host.status().state).toBe('unauthorized')

    const first = host.reload()
    await writeSession(paths, 'new-login-session')
    const second = host.reload()

    await first
    expect(await second).toMatchObject({ state: 'ready', accountId: 'account-1' })
  })

  it('keeps the stopping state when a reload arrives during shutdown', async () => {
    const paths = await createPaths()
    const host = await startHost(paths)

    const stopped = host.stop()
    const reloaded = await host.reload()
    await stopped

    expect(reloaded.state).toBe('stopping')
    expect(host.status().state).toBe('stopping')
    await expect(readLock(paths)).resolves.toBeUndefined()
  })
})
