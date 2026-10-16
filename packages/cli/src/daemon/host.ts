import type { Logger } from '@guiiai/logg'
import type { CoreContext, TelegramApplication, TelegramApplicationRuntime } from '@tg-search/core'
import type { AppResult, DaemonStatus } from '@tg-search/protocol'

import type { ProfilePaths } from '../profile'
import type { DaemonDescriptor } from './profile-state'

import process from 'node:process'

import { chmod, writeFile } from 'node:fs/promises'

import { LogLevel, setGlobalLogLevel } from '@guiiai/logg'
import { defineInvokeHandlers } from '@moeru/eventa'
import { createServer as createIpcServer } from '@moeru/eventa/adapters/unix-socket'
import { generateDefaultConfig } from '@tg-search/common'
import {
  ApplicationError,
  appResult,
  CoreEventType,
  createCoreInstance,
  createTelegramApplicationRuntime,
  destroyCoreInstance,
  initDrizzle,
  models,
  registerApplicationHandlers,
  retryTelegramOperation,
  toAppError,
} from '@tg-search/core'
import { daemonContracts } from '@tg-search/protocol'

import { runtimeBuildInfo } from '../build-info'
import { readProfileConfig, readSession, writeProfileConfig, writeSession } from '../profile'
import { createDaemonLogger, profileScopeId } from '../runtime'
import { createDaemonDiagnostics } from './diagnostics'
import { startDaemonLogMaintenance } from './log-maintenance'
import { acquireProfileLock, processIdentity, removeIfExists, socketPathFor } from './profile-state'
import { createDaemonReconnectRecovery } from './reconnect-recovery'

export interface DaemonHost {
  status: () => DaemonStatus
  reload: () => Promise<DaemonStatus>
  recover: () => Promise<DaemonStatus>
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
    let onCoreError: (data: { error: string, code?: string }) => void
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
    onCoreError = ({ error, code }) => {
      if (code !== 'SYNC_CATCH_UP_FAILED')
        finish(new Error(error))
    }
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

export function createDaemonApplicationProxy(getApplication: () => TelegramApplicationRuntime, onRead?: (source: 'local' | 'telegram', result: AppResult<unknown>) => void): TelegramApplication {
  const observe = async <T>(source: 'local' | 'telegram', request: () => Promise<AppResult<T>>) => {
    const result = await Promise.resolve().then(request).catch(error => ({ ok: false as const, error: toAppError(error) }))
    onRead?.(source, result)
    return result
  }
  return {
    readMessageMedia: (input, options) => observe(input.source, () => getApplication().readMessageMedia(input, options)),
    getReplyContext: (input, options) => observe(input.source, () => getApplication().getReplyContext(input, options)),
    readMessages: (input, options) => observe(input.source, () => getApplication().readMessages(input, options)),
    getMessages: (input, options) => observe(input.source, () => getApplication().getMessages(input, options)),
    listChats: (input, options) => observe('telegram', () => getApplication().listChats(input, options)),
    listRemoteMessages: (input, options) => observe('telegram', () => getApplication().listRemoteMessages(input, options)),
    queryLocalMessages: (input, options) => observe('local', () => getApplication().queryLocalMessages(input, options)),
    searchLocalMessages: (input, options) => observe('local', () => getApplication().searchLocalMessages(input, options)),
    getLocalMessageContext: (input, options) => observe('local', () => getApplication().getLocalMessageContext(input, options)),
    getLocalStats: (input, options) => observe('local', () => getApplication().getLocalStats(input, options)),
    exportLocal: (input, signal) => getApplication().exportLocal!(input, signal),
    sync: (input, signal) => getApplication().sync(input, signal),
  }
}

export async function createDaemonHost(paths: ProfilePaths, profile: string): Promise<DaemonHost> {
  setGlobalLogLevel(LogLevel.Log)
  const startedAt = Date.now()
  const diagnostics = createDaemonDiagnostics()
  const build = runtimeBuildInfo(import.meta.url)
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
  let transportConnected = false
  const stopped = new Promise<void>((resolve) => {
    resolveStopped = resolve
  })

  const status = (): DaemonStatus => ({ profile, pid: process.pid, startedAt, state, accountId, error: lastError, health: diagnostics.snapshot(), build })
  const currentApplication = () => {
    if (!activeRuntime)
      throw new ApplicationError({ code: 'DAEMON_RUNTIME_UNAVAILABLE', message: `Daemon is ${state}; application runtime is unavailable`, retryable: true })
    return activeRuntime.application
  }
  const applicationProxy = createDaemonApplicationProxy(currentApplication, diagnostics.read)

  const reconnectRecovery = createDaemonReconnectRecovery({
    async recover() {
      const runtime = activeRuntime
      if (stopping || state !== 'reconnecting' || transportConnected || !runtime)
        return true

      diagnostics.recoveryStarted()
      let recovered = false
      try {
        logger.warn('Telegram transport remained disconnected; retrying after the client retry budget was exhausted')
        const connected = await runtime.context.getClient().connect()
        recovered = connected && transportConnected
        return recovered
      }
      catch (error) {
        logger.withError(error).warn('Telegram transport recovery attempt failed')
        return false
      }
      finally {
        diagnostics.recoveryFinished(recovered)
      }
    },
  })

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
    reconnectRecovery.stop()
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
    const isActiveContext = () => activeRuntime?.context === context
    context.emitter.on(CoreEventType.SessionUpdate, ({ session }) => {
      if (!isActiveContext())
        return
      void writeSession(paths, session).catch(error => logger.withError(error).warn('Failed to persist daemon session'))
    })
    context.emitter.on(CoreEventType.AuthDisconnected, () => {
      if (!isActiveContext())
        return
      reconnectRecovery.reset()
      transportConnected = false
      state = 'unauthorized'
      diagnostics.authorization('unauthorized')
      diagnostics.transport('disconnected')
      accountId = undefined
    })
    context.emitter.on(CoreEventType.AuthError, () => {
      if (!isActiveContext())
        return
      diagnostics.authorization('unauthorized')
      state = 'unauthorized'
      accountId = undefined
      lastError = 'Telegram session authentication failed'
    })
    context.emitter.on(CoreEventType.GramConnectionState, ({ state: connectionState }) => {
      if (!isActiveContext())
        return
      diagnostics.transport(connectionState)
      if (connectionState === 'connected' && accountId) {
        transportConnected = true
        reconnectRecovery.reset()
        state = 'ready'
        lastError = undefined
      }
      else if (connectionState === 'connected') {
        transportConnected = true
        reconnectRecovery.reset()
      }
      else if (connectionState === 'disconnected') {
        transportConnected = false
        state = 'reconnecting'
        lastError = 'Telegram connection interrupted; reconnecting'
        reconnectRecovery.schedule()
      }
      else if (connectionState === 'broken') {
        reconnectRecovery.reset()
        transportConnected = false
        state = 'error'
        diagnostics.authorization('unauthorized')
        lastError = 'Telegram connection authorization is broken'
      }
    })
    context.emitter.on(CoreEventType.SyncStatus, ({ status: syncStatus }) => {
      if (!isActiveContext())
        return
      diagnostics.catchUp(syncStatus === 'syncing' ? 'running' : syncStatus === 'error' ? 'failed' : 'idle', syncStatus === 'error' ? 'Telegram historical catch-up failed' : undefined)
      if (transportConnected && accountId)
        state = 'ready'
    })
    context.emitter.on(CoreEventType.CoreError, ({ error, code }) => {
      if (!isActiveContext())
        return
      lastError = error
      if (code === 'SYNC_CATCH_UP_FAILED') {
        diagnostics.catchUp('failed', error)
      }
      else if (state === 'starting' || state === 'reconnecting') {
        state = 'error'
      }
    })
  }

  const replaceRuntime = async (session: string | undefined): Promise<DaemonStatus> => {
    reconnectRecovery.reset()
    transportConnected = false
    state = session ? 'starting' : 'unauthorized'
    diagnostics.transport(session ? 'starting' : 'disconnected')
    diagnostics.authorization(session ? 'unknown' : 'unauthorized')
    diagnostics.catchUp('unknown')
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
      diagnostics.authorization('authorized')
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

  const recover = (): Promise<DaemonStatus> => {
    if (reloadInFlight)
      return reloadInFlight
    reloadInFlight = (async () => {
      const latest = await readProfileConfig(paths)
      if (!(latest.apiId ?? process.env.TELEGRAM_API_ID) || !(latest.apiHash ?? process.env.TELEGRAM_API_HASH))
        throw new ApplicationError({ code: 'DAEMON_RECOVERY_UNAVAILABLE', message: 'Telegram API credentials are missing; configure this profile before recovery', retryable: false })
      const session = await readSession(paths)
      if (!session)
        throw new ApplicationError({ code: 'AUTH_REQUIRED', message: 'Saved Telegram session is missing; run auth login before recovery', retryable: false })
      diagnostics.recoveryStarted()
      try {
        const result = await replaceRuntime(session)
        diagnostics.recoveryFinished(result.state === 'ready')
        return status()
      }
      catch (error) {
        diagnostics.recoveryFinished(false)
        throw error
      }
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
        recover: () => appResult(recover),
        status,
        stop: () => {
          const response = { ...status(), state: 'stopping' as const }
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

    return { status, reload, recover, stop, wait: () => stopped }
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
