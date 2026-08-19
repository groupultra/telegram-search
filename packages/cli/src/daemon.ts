import type { Logger } from '@guiiai/logg'
import type { DaemonStatus } from '@tg-search/protocol'

import type { ProfilePaths } from './profile'
import type { createCliRuntime } from './runtime'

import process from 'node:process'

import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LogLevel, setGlobalLogLevel } from '@guiiai/logg'
import { defineInvokeHandlers, defineInvokes, defineStreamInvoke } from '@moeru/eventa'
import { connect as connectIpcSocket, createServer as createIpcServer } from '@moeru/eventa/adapters/unix-socket'
import { generateDefaultConfig } from '@tg-search/common'
import {
  CoreEventType,
  createCoreInstance,
  createTelegramApplicationRuntime,
  destroyCoreInstance,
  initDrizzle,
  models,
  registerApplicationHandlers,
  retryTelegramOperation,
} from '@tg-search/core'
import {
  chatContracts,
  daemonContracts,
  exportContracts,
  messageContracts,
  statsContracts,
  syncContracts,
} from '@tg-search/protocol'

import { startDaemonLogMaintenance } from './daemon-log-maintenance'
import { readProfileConfig, readSession, writeProfileConfig, writeSession } from './profile'
import { createDaemonLogger, profileScopeId } from './runtime'

interface DaemonDescriptor {
  pid: number
  profile: string
  socket: string
  startedAt: number
}

type CliRuntime = Awaited<ReturnType<typeof createCliRuntime>>

export type DaemonClientRuntime = Pick<CliRuntime, 'streams'> & {
  invokes: CliRuntime['invokes'] & {
    daemon: {
      reload: (input: Record<string, never>) => Promise<DaemonStatus>
      status: (input: Record<string, never>) => Promise<DaemonStatus>
      stop: (input: Record<string, never>) => Promise<DaemonStatus>
    }
  }
  close: () => void
}

export interface DaemonHost {
  status: () => DaemonStatus
  reload: () => Promise<DaemonStatus>
  stop: () => Promise<void>
  wait: () => Promise<void>
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function readDescriptor(paths: ProfilePaths): Promise<DaemonDescriptor | undefined> {
  try {
    return JSON.parse(await readFile(paths.daemon, 'utf8')) as DaemonDescriptor
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined
    throw error
  }
}

async function removeIfExists(path: string): Promise<void> {
  try {
    await unlink(path)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
}

async function acquireProfileLock(paths: ProfilePaths): Promise<() => Promise<void>> {
  try {
    await writeFile(paths.daemonLock, `${process.pid}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
      throw error

    const lockPid = Number.parseInt(await readFile(paths.daemonLock, 'utf8'), 10)
    if (Number.isSafeInteger(lockPid) && isProcessRunning(lockPid))
      throw new Error(`Daemon already running for profile at PID ${lockPid}`)

    await removeIfExists(paths.daemonLock)
    return acquireProfileLock(paths)
  }
  await chmod(paths.daemonLock, 0o600)
  return async () => removeIfExists(paths.daemonLock)
}

async function socketPathFor(paths: ProfilePaths): Promise<string> {
  const uid = typeof process.getuid === 'function' ? process.getuid() : process.pid
  const directory = join(tmpdir(), `tg-search-${uid}`)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const digest = createHash('sha256').update(paths.root).digest('hex').slice(0, 24)
  return join(directory, `${digest}.sock`)
}

function daemonStatus(profile: string, startedAt: number, state: DaemonStatus['state'], accountId?: string, error?: string): DaemonStatus {
  return { profile, pid: process.pid, startedAt, state, accountId, error }
}

export async function createDaemonHost(paths: ProfilePaths, profile: string): Promise<DaemonHost> {
  setGlobalLogLevel(LogLevel.Log)
  const releaseLock = await acquireProfileLock(paths)
  const socket = await socketPathFor(paths)
  const startedAt = Date.now()
  const logger: Logger = createDaemonLogger(profile)
  let state: DaemonStatus['state'] = 'starting'
  let accountId: string | undefined
  let lastError: string | undefined
  let stopping = false
  let resolveStopped: (() => void) | undefined
  let stopLogMaintenance: (() => void) | undefined
  const stopped = new Promise<void>((resolve) => {
    resolveStopped = resolve
  })

  try {
    stopLogMaintenance = await startDaemonLogMaintenance(paths, logger)
    await removeIfExists(socket)
    let profileConfig = await readProfileConfig(paths)
    const config = generateDefaultConfig()
    config.api.telegram.apiId = profileConfig.apiId ?? process.env.TELEGRAM_API_ID
    config.api.telegram.apiHash = profileConfig.apiHash ?? process.env.TELEGRAM_API_HASH
    const { db, pglite } = await initDrizzle(logger, config, { dbPath: paths.database })
    const context = createCoreInstance(() => db, config, undefined, logger)
    context.setCurrentAccountId(profileConfig.accountId ?? profileScopeId(paths.root))
    const application = createTelegramApplicationRuntime({
      context,
      logger,
      models,
      retryTelegramRead: operation => retryTelegramOperation(operation),
    })

    context.emitter.on(CoreEventType.SessionUpdate, ({ session }) => {
      void writeSession(paths, session).catch(() => {})
    })
    context.emitter.on(CoreEventType.AccountReady, ({ accountId: readyAccountId }) => {
      accountId = readyAccountId
      state = 'ready'
      lastError = undefined
      void (async () => {
        profileConfig = { ...profileConfig, accountId: readyAccountId }
        await writeProfileConfig(paths, profileConfig)
      })().catch((error) => {
        lastError = error instanceof Error ? error.message : String(error)
        state = 'error'
      })
    })
    context.emitter.on(CoreEventType.AuthDisconnected, () => {
      state = 'unauthorized'
      accountId = undefined
    })
    context.emitter.on(CoreEventType.GramConnectionState, ({ state: connectionState }) => {
      if (connectionState === 'connected' && accountId && state !== 'reconnecting') {
        state = 'ready'
        lastError = undefined
      }
      else if (connectionState === 'disconnected') {
        state = 'reconnecting'
        lastError = 'Telegram connection interrupted; reconnecting'
      }
      else if (connectionState === 'broken') {
        state = 'error'
        lastError = 'Telegram connection authorization is broken'
      }
    })
    context.emitter.on(CoreEventType.SyncStatus, ({ status: syncStatus }) => {
      if (state !== 'reconnecting')
        return
      if (syncStatus === 'idle') {
        state = 'ready'
        lastError = undefined
      }
      else if (syncStatus === 'error') {
        state = 'error'
        lastError = 'Telegram connection restored, but pts catch-up failed'
      }
    })
    context.emitter.on(CoreEventType.CoreError, ({ error }) => {
      lastError = error
      if (state === 'starting')
        state = 'error'
    })

    const status = () => daemonStatus(profile, startedAt, state, accountId, lastError)
    const reload = async () => {
      if (state === 'ready' || state === 'starting')
        return status()

      const session = await readSession(paths)
      if (!session) {
        state = 'unauthorized'
        lastError = undefined
        return status()
      }

      state = 'starting'
      lastError = undefined
      context.emitter.emit(CoreEventType.AuthLogin, { session })
      return status()
    }

    let closeServer: (() => Promise<void>) | undefined
    const stop = async () => {
      if (stopping)
        return
      stopping = true
      state = 'stopping'
      stopLogMaintenance?.()
      await closeServer?.()
      await application.dispose()
      await destroyCoreInstance(context)
      await pglite?.close()
      await removeIfExists(paths.daemon)
      await removeIfExists(socket)
      await releaseLock()
      resolveStopped?.()
    }

    const server = await createIpcServer(socket, (connection) => {
      const unregisterApplication = registerApplicationHandlers(connection.context, application)
      const unregisterDaemon = defineInvokeHandlers(connection.context, daemonContracts, {
        reload,
        status,
        stop: () => {
          const response = daemonStatus(profile, startedAt, 'stopping', accountId, lastError)
          setTimeout(() => void stop(), 0)
          return response
        },
      })
      connection.context.signal.addEventListener('abort', () => {
        unregisterApplication()
        for (const unregister of Object.values(unregisterDaemon))
          unregister()
      }, { once: true })
    })

    closeServer = server.close

    const descriptor: DaemonDescriptor = { pid: process.pid, profile, socket, startedAt }
    await writeFile(paths.daemon, `${JSON.stringify(descriptor)}\n`, { mode: 0o600 })
    await chmod(paths.daemon, 0o600)

    state = 'unauthorized'
    await reload()

    return { status, reload, stop, wait: () => stopped }
  }
  catch (error) {
    stopLogMaintenance?.()
    await removeIfExists(paths.daemon)
    await removeIfExists(socket)
    await releaseLock()
    throw error
  }
}

export async function runDaemon(paths: ProfilePaths, profile: string): Promise<void> {
  const host = await createDaemonHost(paths, profile)
  const stop = () => void host.stop()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    await host.wait()
  }
  finally {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
}

export async function connectDaemon(paths: ProfilePaths): Promise<DaemonClientRuntime | undefined> {
  const descriptor = await readDescriptor(paths)
  if (!descriptor || !isProcessRunning(descriptor.pid))
    return undefined

  const connection = await connectIpcSocket(descriptor.socket)
  const client: DaemonClientRuntime = {
    invokes: {
      chats: defineInvokes(connection.context, chatContracts),
      messages: defineInvokes(connection.context, messageContracts),
      stats: defineInvokes(connection.context, statsContracts),
      daemon: defineInvokes(connection.context, daemonContracts),
    },
    streams: {
      export: defineStreamInvoke(connection.context, exportContracts.run),
      sync: defineStreamInvoke(connection.context, syncContracts.run),
    },
    close: () => connection.dispose(),
  }
  return client
}
