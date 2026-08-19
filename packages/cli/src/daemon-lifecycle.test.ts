import type { TelegramApplicationRuntime } from '@tg-search/core'

import type { ProfilePaths } from './profile'

import process from 'node:process'

import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createServer as createIpcServer } from '@moeru/eventa/adapters/unix-socket'
import { CoreEventType } from '@tg-search/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectDaemon, createAccountReadyWait, createDaemonApplicationProxy, persistProfileAccountId } from './daemon'
import { readProfileConfig, writeProfileConfig } from './profile'

const directories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function createPaths(): Promise<ProfilePaths> {
  const root = await mkdtemp(join(tmpdir(), 'tg-search-daemon-lifecycle-'))
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

describe('daemon lifecycle boundaries', () => {
  it('keeps existing IPC handlers bound to the latest application runtime', async () => {
    let account = 'first-account'
    const application = () => ({
      getLocalStats: vi.fn(async () => ({ ok: true, data: { account } })),
    }) as unknown as TelegramApplicationRuntime
    let active = application()
    const proxy = createDaemonApplicationProxy(() => active)

    await expect(proxy.getLocalStats({ groupBy: 'month', timeZone: 'UTC' })).resolves.toMatchObject({
      data: { account: 'first-account' },
    })
    account = 'second-account'
    active = application()
    await expect(proxy.getLocalStats({ groupBy: 'month', timeZone: 'UTC' })).resolves.toMatchObject({
      data: { account: 'second-account' },
    })
  })

  it('merges a resolved account into the latest profile config', async () => {
    const paths = await createPaths()
    await writeProfileConfig(paths, { apiId: 'new-id', apiHash: 'new-hash' })

    await persistProfileAccountId(paths, 'account-1')

    await expect(readProfileConfig(paths)).resolves.toEqual({
      apiId: 'new-id',
      apiHash: 'new-hash',
      accountId: 'account-1',
    })
  })

  it('cancels an account-ready wait and removes all listeners', async () => {
    const emitter = new EventEmitter()
    const ready = createAccountReadyWait({ emitter } as never, 10_000)

    ready.cancel(new Error('Daemon is stopping'))

    await expect(ready.promise).rejects.toThrow('Daemon is stopping')
    expect(emitter.listenerCount(CoreEventType.AccountReady)).toBe(0)
    expect(emitter.listenerCount(CoreEventType.AuthDisconnected)).toBe(0)
    expect(emitter.listenerCount(CoreEventType.AuthError)).toBe(0)
    expect(emitter.listenerCount(CoreEventType.CoreError)).toBe(0)
  })

  it('waits for the daemon descriptor instead of opening a fallback runtime', async () => {
    const paths = await createPaths()
    const socket = join(paths.root, 'daemon.sock')
    await writeFile(paths.daemonLock, `${process.pid}\n`)

    let closeServer: (() => Promise<void>) | undefined
    const published = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        void (async () => {
          try {
            const server = await createIpcServer(socket, () => {})
            closeServer = server.close
            await writeFile(paths.daemon, `${JSON.stringify({
              pid: process.pid,
              profile: 'test',
              socket,
              startedAt: Date.now(),
            })}\n`)
            resolve()
          }
          catch (error) {
            reject(error)
          }
        })()
      }, 20)
    })

    const connecting = connectDaemon(paths)
    await published
    const client = await connecting

    expect(client).toBeDefined()
    client?.close()
    await closeServer?.()
  })

  it('does not trust a reused pid with a different process identity', async () => {
    const paths = await createPaths()
    await writeFile(paths.daemonLock, `${JSON.stringify({
      pid: process.pid,
      processIdentity: 'different-process-start',
      startedAt: 1,
    })}\n`)

    await expect(connectDaemon(paths)).resolves.toBeUndefined()
  })

  it('does not connect through a descriptor owned by a reused pid', async () => {
    const paths = await createPaths()
    await writeFile(paths.daemon, `${JSON.stringify({
      pid: process.pid,
      processIdentity: 'different-process-start',
      profile: 'test',
      socket: join(paths.root, 'stale.sock'),
      startedAt: 1,
    })}\n`)

    await expect(connectDaemon(paths)).resolves.toBeUndefined()
  })
})
