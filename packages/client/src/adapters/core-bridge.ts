import type { Config } from '@tg-search/common'
import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext, StoredSession } from '../types/session'

import defu from 'defu'

import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { generateDefaultConfig, initConfig } from '@tg-search/common'
import { createCoreInstance, destroyCoreInstance, initDrizzle } from '@tg-search/core'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'

export const useCoreBridgeStore = defineStore('core-bridge', () => {
  const storageSessions = useLocalStorage<StoredSession[]>('core-bridge/sessions', [])
  // active-session-slot: index into storageSessions array
  const storageActiveSessionSlot = useLocalStorage<number>('core-bridge/active-session-slot', 0)
  const logger = useLogger('CoreBridge')
  let ctx: CoreContext | undefined
  const config = useLocalStorage<Config>('core-bridge/config', generateDefaultConfig())

  const activeSessionId = computed(() => {
    const slot = storageActiveSessionSlot.value
    const session = storageSessions.value[slot]
    return session?.uuid ?? ''
  })

  // When switching accounts, destroy the existing CoreContext so that the
  // next interaction will create a fresh instance for the new account.
  watch(activeSessionId, (newId, oldId) => {
    if (!oldId || newId === oldId)
      return
    if (!ctx)
      return

    logger.withFields({ oldId, newId }).debug('Active session changed, destroying CoreContext')
    destroyCoreInstance(ctx).catch((error) => {
      logger.withError(error).error('Failed to destroy CoreContext on account switch')
    })
    ctx = undefined
  })

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)
  const isInitialized = ref(false)

  const ensureSessionInvariants = () => {
    if (!Array.isArray(storageSessions.value))
      storageSessions.value = []

    if (storageSessions.value.length === 0) {
      storageSessions.value = [{
        uuid: uuidv4(),
        metadata: {},
      }]
      storageActiveSessionSlot.value = 0
      return
    }

    if (storageActiveSessionSlot.value < 0 || storageActiveSessionSlot.value >= storageSessions.value.length)
      storageActiveSessionSlot.value = 0
  }

  ensureSessionInvariants()

  function serializeError(err: unknown) {
    if (err instanceof Error) {
      return err.message
    }
    return String(err ?? 'Unknown error')
  }

  function deepClone<T>(data?: T): T | undefined {
    if (!data)
      return data

    try {
      let toSerialize: unknown = data

      // Normalise error field without mutating original object
      if (data && typeof data === 'object' && 'error' in data) {
        const withError = data as { error: unknown }
        toSerialize = {
          ...(data as object),
          error: serializeError(withError.error),
        }
      }

      return JSON.parse(JSON.stringify(toSerialize)) as T
    }
    catch (error) {
      logger.withError(error).error('Failed to deep clone data')
      return data
    }
  }

  function ensureCtx() {
    if (!ctx) {
      if (!config.value)
        throw new Error('Core bridge is not initialized')

      ctx = createCoreInstance(config.value)
    }

    return ctx
  }

  const getActiveSession = () => {
    const slot = storageActiveSessionSlot.value
    return storageSessions.value[slot]?.metadata
  }

  /**
   * Update metadata for the active session slot by shallow-merging the patch.
   * Browser-core mode reuses the same session layout as websocket mode.
   */
  const updateActiveSessionMetadata = (patch: Partial<SessionContext>) => {
    const index = storageActiveSessionSlot.value
    const existing = storageSessions.value[index]
    if (!existing)
      return

    const mergedMetadata = defu({}, patch, existing.metadata ?? {}) as SessionContext

    const sessionsCopy = [...storageSessions.value]
    sessionsCopy[index] = {
      ...existing,
      metadata: mergedMetadata,
    }
    storageSessions.value = sessionsCopy
  }

  /**
   * Update metadata for a specific session identified by its uuid.
   * Does nothing if the session does not exist.
   */
  const updateSessionMetadataById = (sessionId: string, patch: Partial<SessionContext>) => {
    if (!sessionId)
      return

    const index = storageSessions.value.findIndex(session => session.uuid === sessionId)
    if (index === -1)
      return

    const existing = storageSessions.value[index]
    const mergedMetadata = defu({}, patch, existing.metadata ?? {}) as SessionContext

    const sessionsCopy = [...storageSessions.value]
    sessionsCopy[index] = {
      ...existing,
      metadata: mergedMetadata,
    }
    storageSessions.value = sessionsCopy
  }

  const switchAccount = (sessionId: string) => {
    const index = storageSessions.value.findIndex(session => session.uuid === sessionId)
    if (index !== -1) {
      storageActiveSessionSlot.value = index
      logger.withFields({ sessionId }).verbose('Switched to account')
    }
  }

  const addNewAccount = () => {
    // Create a brand new slot immediately and switch to it.
    const newId = uuidv4()
    const sessionsCopy = [...storageSessions.value, {
      uuid: newId,
      metadata: {},
    } satisfies StoredSession]

    storageSessions.value = sessionsCopy
    storageActiveSessionSlot.value = sessionsCopy.length - 1

    return newId
  }

  /**
   * Apply session:update to the current active account.
   *
   * We rely on the caller to select the appropriate active slot before
   * triggering the login flow.
   */
  const applySessionUpdate = (session: string) => {
    updateActiveSessionMetadata({ session })
  }

  const logoutCurrentAccount = async () => {
    const index = storageActiveSessionSlot.value
    const sessions = storageSessions.value

    if (index < 0 || index >= sessions.length)
      return

    const newSessions = [...sessions.slice(0, index), ...sessions.slice(index + 1)]
    storageSessions.value = newSessions

    if (newSessions.length === 0) {
      storageActiveSessionSlot.value = 0
    }
    else if (index >= newSessions.length) {
      storageActiveSessionSlot.value = newSessions.length - 1
    }
    else {
      storageActiveSessionSlot.value = index
    }

    // Emit logout event
    sendEvent('auth:logout', undefined)
  }

  const cleanup = () => {
    storageSessions.value = []
    storageActiveSessionSlot.value = 0
  }

  /**
   * Send event to core
   */
  function sendEvent<T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) {
    const ctx = ensureCtx()!
    logger.withFields({ event, data }).debug('Receive event from client')

    try {
      if (event === 'server:event:register') {
        data = data as WsEventToServerData<'server:event:register'>
        const eventName = data.event as keyof FromCoreEvent

        if (!eventName.startsWith('server:')) {
          const fn = (payload: WsEventToClientData<keyof FromCoreEvent>) => {
            logger.withFields({ eventName }).debug('Sending event to client')
            // FromCoreEvent keys are a superset of WsEventToClient keys; we assert compatibility here.
            const message = {
              type: eventName as unknown as WsMessageToClient['type'],
              data: payload,
            } as WsMessageToClient
            sendWsEvent(message)
          }

          ctx.emitter.on(eventName, fn as (...args: unknown[]) => void)
        }
      }
      else {
        logger.withFields({ event, data }).debug('Emit event to core')
        ctx.emitter.emit(event, deepClone(data) as CoreEventData<keyof ToCoreEvent>)
      }
    }
    catch (error) {
      logger.withError(error).error('Failed to send event to core')
    }
  }

  async function init() {
    if (isInitialized.value) {
      logger.debug('Core bridge already initialized, skipping')
      return
    }

    config.value = await initConfig()
    config.value.api.telegram.apiId ||= import.meta.env.VITE_TELEGRAM_APP_ID
    config.value.api.telegram.apiHash ||= import.meta.env.VITE_TELEGRAM_APP_HASH

    await initDrizzle(logger, config.value, {
      debuggerWebSocketUrl: import.meta.env.VITE_DB_DEBUGGER_WS_URL as string,
      isDatabaseDebugMode: import.meta.env.VITE_DB_DEBUG === 'true',
    })

    ensureSessionInvariants()

    // Register event handlers once per CoreBridge lifecycle; each handler
    // will register itself with core via server:event:register when needed.
    registerAllEventHandlers(registerEventHandler)

    // Emit an initial server:connected event so the UI knows core-bridge
    // mode is available, mirroring websocket adapter behavior.
    sendWsEvent({ type: 'server:connected', data: { sessionId: activeSessionId.value, connected: false } })

    isInitialized.value = true
  }

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    logger.withFields({ event }).debug('Waiting for event from core')

    return new Promise<WsEventToClientData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: WsEventToClientData<T>) => {
        resolve(deepClone(data) as WsEventToClientData<T>)
      })
    })
  }

  /**
   * Send event to bridge
   */
  function sendWsEvent(event: WsMessageToClient) {
    logger.withFields({ event }).debug('Event send to bridge')

    if (eventHandlers.has(event.type)) {
      const fn = eventHandlers.get(event.type)
      try {
        fn?.(deepClone(event.data) as WsEventToClientData<keyof WsEventToClient>)
      }
      catch (error) {
        logger.withError(error).error('Failed to handle event')
      }
    }

    if (eventHandlersQueue.has(event.type)) {
      drainEventQueue(
        eventHandlersQueue,
        event.type as keyof WsEventToClient,
        deepClone(event.data) as WsEventToClientData<keyof WsEventToClient>,
        (error) => {
          logger.withError(error).error('Failed to handle queued event')
        },
      )
    }
  }

  return {
    init,

    sessions: storageSessions,
    activeSessionId,
    getActiveSession,
    updateActiveSessionMetadata,
    updateSessionMetadataById,
    switchAccount,
    addNewAccount,
    applySessionUpdate,
    logoutCurrentAccount,
    cleanup,

    sendEvent,
    waitForEvent,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoreBridgeStore, import.meta.hot))
}
