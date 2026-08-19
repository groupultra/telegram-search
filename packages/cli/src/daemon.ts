import type { Logger } from '@guiiai/logg'
import type { CoreContext, TelegramApplication, TelegramApplicationRuntime } from '@tg-search/core'
import type { DaemonStatus } from '@tg-search/protocol'

import type { ProfilePaths } from './profile'
import type { createCliRuntime } from './runtime'

import process from 'node:process'

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

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
  processIdentity?: string
  socket: string
  startedAt: number
}

interface DaemonLock {
  pid: number
  processIdentity?: string
  startedAt: number
}

const execFileAsync = promisify(execFile)
const DAEMON_STARTUP_TIMEOUT_MS = 30_000
const DAEMON_STARTUP_POLL_MS = 50

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

export function createAccountReadyWait(
  context: Pick<CoreContext, 'emitter'>,
  timeoutMs = 60_000,
): { promise: Promise<string>, cancel: (error: Error) => void } {
  let cancel!: (error: Error) => void
  const promise = new Promise<string>((resolve, reject) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout>
    let onReady: (data: { accountId: string }) => void
    let onDisconnected: () => void
    let onAuthError: () => void
    let onCoreError: (data: { error: string }) => void
    const cleanup = () => {
      clearTimeout(timeout)
      context.emitter.removeListener(CoreEventType.AccountReady, onReady)
      context.emitter.removeListener(CoreEventType.AuthDisconnected, onDisconnected)
      context.emitter.removeListener(CoreEventType.AuthError, onAuthError)
      context.emitter.removeListener(CoreEventType.CoreError, onCoreError)
    }
    const finish = (error: Error | undefined, readyAccountId?: string) => {
      if (settled)
        return
      settled = true
      cleanup()
      if (error)
        reject(error)
      else
        resolve(readyAccountId!)
    }
    onReady = ({ accountId }) => finish(undefined, accountId)
    onDisconnected = () => finish(new Error('Daemon session is not authorized'))
    onAuthError = () => finish(new Error('Daemon failed to authenticate the saved session'))
    onCoreError = ({ error }) => finish(new Error(error))
    cancel = error => finish(error)
    timeout = setTimeout(() => finish(new Error('Timed out waiting for daemon account initialization')), timeoutMs)

    // CoreContext wraps `on()` for diagnostics, so use the listener API that
    // preserves callback identity for cancellation and cleanup.
    context.emitter.addListener(CoreEventType.AccountReady, onReady)
    context.emitter.addListener(CoreEventType.AuthDisconnected, onDisconnected)
    context.emitter.addListener(CoreEventType.AuthError, onAuthError)
    context.emitter.addListener(CoreEventType.CoreError, onCoreError)
  })
  return { promise, cancel }
}

export async function persistProfileAccountId(paths: ProfilePaths, accountId: string) {
  const latest = await readProfileConfig(paths)
  const next = { ...latest, accountId }
  await writeProfileConfig(paths, next)
  return next
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

async function processIdentity(pid: number): Promise<string | undefined> {
  try {
    if (process.platform === 'linux') {
      const contents = await readFile(`/proc/${pid}/stat`, 'utf8')
      const fields = contents.slice(contents.lastIndexOf(')') + 2).trim().split(/\s+/)
      return fields[19] ? `linux:${fields[19]}` : undefined
    }
    if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)])
      const started = stdout.trim()
      return started ? `darwin:${started}` : undefined
    }
  }
  catch {
    return undefined
  }
  return undefined
}

async function readLock(paths: ProfilePaths): Promise<(DaemonLock & { modifiedAt: number }) | undefined> {
  try {
    const [contents, details] = await Promise.all([
      readFile(paths.daemonLock, 'utf8'),
      stat(paths.daemonLock),
    ])
    try {
      const parsed = JSON.parse(contents) as Partial<DaemonLock> | number
      if (typeof parsed === 'object' && parsed !== null && Number.isSafeInteger(parsed.pid)) {
        return {
          pid: parsed.pid!,
          processIdentity: parsed.processIdentity,
          startedAt: parsed.startedAt ?? details.mtimeMs,
          modifiedAt: details.mtimeMs,
        }
      }
      const pid = typeof parsed === 'number' ? parsed : Number.NaN
      return Number.isSafeInteger(pid) ? { pid, startedAt: details.mtimeMs, modifiedAt: details.mtimeMs } : undefined
    }
    catch {
      const pid = Number.parseInt(contents, 10)
      return Number.isSafeInteger(pid) ? { pid, startedAt: details.mtimeMs, modifiedAt: details.mtimeMs } : undefined
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined
    throw error
  }
}

async function isLockOwnerActive(paths: ProfilePaths, lock: DaemonLock & { modifiedAt: number }): Promise<boolean> {
  if (!isProcessRunning(lock.pid))
    return false

  const actualIdentity = await processIdentity(lock.pid)
  if (lock.processIdentity && actualIdentity)
    return lock.processIdentity === actualIdentity

  const descriptor = await readDescriptor(paths)
  if (descriptor?.pid === lock.pid) {
    try {
      const connection = await connectIpcSocket(descriptor.socket)
      connection.dispose()
      return true
    }
    catch {
      // A descriptor without a reachable socket is not sufficient proof of ownership.
    }
  }

  return Date.now() - lock.modifiedAt < DAEMON_STARTUP_TIMEOUT_MS
}

async function isDescriptorOwnerActive(descriptor: DaemonDescriptor): Promise<boolean> {
  if (!isProcessRunning(descriptor.pid))
    return false

  if (!descriptor.processIdentity)
    return true

  const actualIdentity = await processIdentity(descriptor.pid)
  return !actualIdentity || descriptor.processIdentity === actualIdentity
}

async function acquireProfileLock(paths: ProfilePaths, startedAt: number): Promise<() => Promise<void>> {
  const lock: DaemonLock = {
    pid: process.pid,
    processIdentity: await processIdentity(process.pid),
    startedAt,
  }
  try {
    await writeFile(paths.daemonLock, `${JSON.stringify(lock)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
      throw error

    const existing = await readLock(paths)
    if (existing && await isLockOwnerActive(paths, existing))
      throw new Error(`Daemon already running for profile at PID ${existing.pid}`)

    await removeIfExists(paths.daemonLock)
    return acquireProfileLock(paths, startedAt)
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

export function createDaemonApplicationProxy(getApplication: () => TelegramApplicationRuntime): TelegramApplication {
  return {
    listChats: input => getApplication().listChats(input),
    listRemoteMessages: input => getApplication().listRemoteMessages(input),
    queryLocalMessages: input => getApplication().queryLocalMessages(input),
    searchLocalMessages: input => getApplication().searchLocalMessages(input),
    getLocalMessageContext: input => getApplication().getLocalMessageContext(input),
    getLocalStats: input => getApplication().getLocalStats(input),
    exportLocal: (input, signal) => getApplication().exportLocal!(input, signal),
    sync: (input, signal) => getApplication().sync(input, signal),
  }
}

export async function createDaemonHost(paths: ProfilePaths, profile: string): Promise<DaemonHost> {
  setGlobalLogLevel(LogLevel.Log)
  const startedAt = Date.now()
  const socket = await socketPathFor(paths)
  const logger: Logger = createDaemonLogger(profile)
  let state: DaemonStatus['state'] = 'starting'
  let accountId: string | undefined
  let lastError: string | undefined
  let stopping = false
  let resolveStopped: (() => void) | undefined
  let stopLogMaintenance: (() => void) | undefined
  let closeServer: (() => Promise<void>) | undefined
  let database: Awaited<ReturnType<typeof initDrizzle>> | undefined
  let activeRuntime: { context: ReturnType<typeof createCoreInstance>, application: TelegramApplicationRuntime } | undefined
  let reloadInFlight: Promise<DaemonStatus> | undefined
  let accountReadyWait: ReturnType<typeof createAccountReadyWait> | undefined
  let releaseLock: (() => Promise<void>) | undefined
  const stopped = new Promise<void>((resolve) => {
    resolveStopped = resolve
  })

  const status = () => daemonStatus(profile, startedAt, state, accountId, lastError)
  const currentApplication = () => {
    if (!activeRuntime)
      throw new Error(`Daemon is ${state}; application runtime is unavailable`)
    return activeRuntime.application
  }
  const applicationProxy = createDaemonApplicationProxy(currentApplication)

  const disposeActiveRuntime = async () => {
    const runtime = activeRuntime
    activeRuntime = undefined
    if (!runtime)
      return
    await runtime.application.dispose()
    await destroyCoreInstance(runtime.context)
  }

  let profileConfig = await readProfileConfig(paths)
  const config = generateDefaultConfig()
  config.api.telegram.apiId = profileConfig.apiId ?? process.env.TELEGRAM_API_ID
  config.api.telegram.apiHash = profileConfig.apiHash ?? process.env.TELEGRAM_API_HASH

  const cleanupResources = async () => {
    stopLogMaintenance?.()
    stopLogMaintenance = undefined

    const cleanup = async (label: string, action: (() => Promise<void>) | undefined) => {
      if (!action)
        return
      try {
        await action()
      }
      catch (error) {
        logger.withError(error).warn(`Failed to ${label} while cleaning up daemon resources`)
      }
    }

    const serverCloser = closeServer
    closeServer = undefined
    await cleanup('close IPC server', serverCloser)
    await cleanup('dispose application runtime', disposeActiveRuntime)

    const pglite = database?.pglite
    database = undefined
    await cleanup('close daemon database', pglite ? () => pglite.close() : undefined)
    await cleanup('remove daemon descriptor', () => removeIfExists(paths.daemon))
    await cleanup('remove daemon socket', () => removeIfExists(socket))

    const unlock = releaseLock
    releaseLock = undefined
    await cleanup('release daemon profile lock', unlock)
  }

  const bindRuntimeEvents = (context: ReturnType<typeof createCoreInstance>) => {
    context.emitter.on(CoreEventType.SessionUpdate, ({ session }) => {
      void writeSession(paths, session).catch(error => logger.withError(error).warn('Failed to persist daemon session'))
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
    context.emitter.on(CoreEventType.CoreError, ({ error, description }) => {
      lastError = error
      if (state === 'starting' || state === 'reconnecting' || description === 'Catch-up sync failed')
        state = 'error'
    })
  }

  const replaceRuntime = async (session: string | undefined): Promise<DaemonStatus> => {
    state = session ? 'starting' : 'unauthorized'
    accountId = undefined
    lastError = undefined
    await disposeActiveRuntime()

    if (stopping)
      return status()

    if (!database)
      throw new Error('Daemon database is unavailable')

    profileConfig = await readProfileConfig(paths)
    if (stopping)
      return status()

    config.api.telegram.apiId = profileConfig.apiId ?? process.env.TELEGRAM_API_ID
    config.api.telegram.apiHash = profileConfig.apiHash ?? process.env.TELEGRAM_API_HASH

    const context = createCoreInstance(() => database!.db, config, undefined, logger)
    context.setCurrentAccountId(profileConfig.accountId ?? profileScopeId(paths.root))
    bindRuntimeEvents(context)
    const application = createTelegramApplicationRuntime({
      context,
      logger,
      models,
      retryTelegramRead: operation => retryTelegramOperation(operation),
    })
    activeRuntime = { context, application }

    if (!session)
      return status()

    try {
      const ready = createAccountReadyWait(context)
      accountReadyWait = ready
      context.emitter.emit(CoreEventType.AuthLogin, { session })
      accountId = await ready.promise
      if (stopping)
        return status()
      profileConfig = await persistProfileAccountId(paths, accountId)
      if (stopping)
        return status()

      state = 'ready'
      lastError = undefined
    }
    catch (error) {
      if (!stopping) {
        lastError = error instanceof Error ? error.message : String(error)
        state = 'error'
      }
    }
    finally {
      accountReadyWait = undefined
    }
    return status()
  }

  const reload = (): Promise<DaemonStatus> => {
    if (reloadInFlight)
      return reloadInFlight

    reloadInFlight = (async () => {
      const session = await readSession(paths)
      if (!session)
        return replaceRuntime(undefined)

      if (state === 'ready' && activeRuntime) {
        try {
          if (String(activeRuntime.context.getClient().session.save()) === session)
            return status()
        }
        catch {
          // A ready daemon without a usable client must rebuild from the persisted session.
        }
      }

      return replaceRuntime(session)
    })().finally(() => {
      reloadInFlight = undefined
    })
    return reloadInFlight
  }

  releaseLock = await acquireProfileLock(paths, startedAt)
  try {
    stopLogMaintenance = await startDaemonLogMaintenance(paths, logger)
    await removeIfExists(socket)
    database = await initDrizzle(logger, config, { dbPath: paths.database })
    await replaceRuntime(await readSession(paths))

    const stop = async () => {
      if (stopping)
        return
      stopping = true
      state = 'stopping'
      accountReadyWait?.cancel(new Error('Daemon is stopping'))
      await reloadInFlight?.catch(() => undefined)
      await cleanupResources()
      resolveStopped?.()
    }

    const server = await createIpcServer(socket, (connection) => {
      const unregisterApplication = registerApplicationHandlers(connection.context, applicationProxy)
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

    const descriptor: DaemonDescriptor = {
      pid: process.pid,
      processIdentity: await processIdentity(process.pid),
      profile,
      socket,
      startedAt,
    }
    await writeFile(paths.daemon, `${JSON.stringify(descriptor)}\n`, { mode: 0o600 })
    await chmod(paths.daemon, 0o600)

    return { status, reload, stop, wait: () => stopped }
  }
  catch (error) {
    await cleanupResources()
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
  const deadline = Date.now() + DAEMON_STARTUP_TIMEOUT_MS
  while (true) {
    const descriptor = await readDescriptor(paths)
    if (descriptor && await isDescriptorOwnerActive(descriptor)) {
      try {
        const connection = await connectIpcSocket(descriptor.socket)
        return {
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
      }
      catch {
        // The descriptor can become visible just before the socket accepts connections.
      }
    }

    const lock = await readLock(paths)
    if (!lock || !await isLockOwnerActive(paths, lock))
      return undefined
    if (Date.now() >= deadline)
      throw new Error(`Daemon startup timed out for profile root ${paths.root}`)
    await new Promise(resolve => setTimeout(resolve, DAEMON_STARTUP_POLL_MS))
  }
}
