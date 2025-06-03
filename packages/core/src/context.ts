import type { TelegramClient } from 'telegram'
import type { ClientInstanceEventFromCore, ClientInstanceEventToCore } from './instance'
import type { SessionEventFromCore, SessionEventToCore } from './services'
import type { ConfigEventFromCore, ConfigEventToCore } from './services/config'
import type { ConnectionEventFromCore, ConnectionEventToCore } from './services/connection'
import type { DialogEventFromCore, DialogEventToCore } from './services/dialog'
import type { EntityEventFromCore, EntityEventToCore } from './services/entity'
import type { GramEventsEventFromCore, GramEventsEventToCore } from './services/gram-events'
import type { MessageEventFromCore, MessageEventToCore } from './services/message'
import type { StorageEventFromCore, StorageEventToCore } from './services/storage'
import type { TakeoutEventFromCore, TakeoutEventToCore } from './services/takeout'

import { useLogger } from '@tg-search/common'
import { EventEmitter } from 'eventemitter3'
import { Api } from 'telegram'
import { FloodWaitError } from 'telegram/errors'

export type FromCoreEvent = ClientInstanceEventFromCore
  & MessageEventFromCore
  & DialogEventFromCore
  & ConnectionEventFromCore
  & TakeoutEventFromCore
  & SessionEventFromCore
  & EntityEventFromCore
  & StorageEventFromCore
  & ConfigEventFromCore
  & GramEventsEventFromCore

export type ToCoreEvent = ClientInstanceEventToCore
  & MessageEventToCore
  & DialogEventToCore
  & ConnectionEventToCore
  & TakeoutEventToCore
  & SessionEventToCore
  & EntityEventToCore
  & StorageEventToCore
  & ConfigEventToCore
  & GramEventsEventToCore

export type CoreEvent = FromCoreEvent & ToCoreEvent

export type CoreEventData<T> = T extends (data: infer D) => void ? D : never

export type CoreEmitter = EventEmitter<CoreEvent>

export type Service<T> = (ctx: CoreContext) => T

export type CoreContext = ReturnType<typeof createCoreContext>

function createErrorHandler(emitter: CoreEmitter) {
  const logger = useLogger()

  return (error: unknown, description?: string): Error => {
    if (error instanceof FloodWaitError) {
      logger.withFields({ seconds: error.seconds }).warn('Flood wait')

      return error
    }
    else if (error instanceof Api.RpcError) {
      emitter.emit('core:error', { error })
      logger.withFields({ error: error.errorMessage }).error('RPC error')

      return new Error(error.errorMessage)
    }
    else {
      emitter.emit('core:error', { error })
      logger.withError(error).error(description || 'Error occurred')

      return new Error(description || 'Error occurred')
    }
  }
}

export function createCoreContext() {
  const emitter = new EventEmitter<CoreEvent>()
  const withError = createErrorHandler(emitter)
  let telegramClient: TelegramClient

  const toCoreEvents = new Set<keyof ToCoreEvent>()
  const fromCoreEvents = new Set<keyof FromCoreEvent>()

  const wrapEmitterOn = (emitter: CoreEmitter, fn?: (event: keyof ToCoreEvent) => void) => {
    const _on = emitter.on.bind(emitter)

    emitter.on = (event, listener) => {
      const onFn = _on(event, async (...args) => {
        try {
          fn?.(event as keyof ToCoreEvent)

          useLogger().withFields({ event }).debug('Handle core event')
          return await listener(...args)
        }
        catch (error) {
          useLogger().withError(error).error('Failed to handle core event')
        }
      })

      if (toCoreEvents.has(event as keyof ToCoreEvent)) {
        return onFn
      }

      useLogger().withFields({ event }).debug('Register to core event')
      toCoreEvents.add(event as keyof ToCoreEvent)
      return onFn
    }
  }

  const wrapEmitterEmit = (emitter: CoreEmitter, fn?: (event: keyof FromCoreEvent) => void) => {
    const _emit = emitter.emit.bind(emitter)

    emitter.emit = (event, ...args) => {
      if (fromCoreEvents.has(event as keyof FromCoreEvent)) {
        return _emit(event, ...args)
      }

      useLogger().withFields({ event }).debug('Register from core event')

      fromCoreEvents.add(event as keyof FromCoreEvent)
      fn?.(event as keyof FromCoreEvent)

      return _emit(event, ...args)
    }
  }

  function setClient(client: TelegramClient) {
    useLogger().debug('Set Telegram client')
    telegramClient = client
  }

  function ensureClient(): TelegramClient {
    if (!telegramClient) {
      throw withError('Telegram client not set')
    }

    return telegramClient
  }

  wrapEmitterOn(emitter, (event) => {
    useLogger('core:event').withFields({ event }).log('Core event received')
  })

  wrapEmitterEmit(emitter, (event) => {
    useLogger('core:event').withFields({ event }).log('Core event emitted')
  })

  return {
    emitter,
    toCoreEvents,
    fromCoreEvents,
    wrapEmitterEmit,
    wrapEmitterOn,
    setClient,
    getClient: ensureClient,
    withError,
  }
}

export function useService<T>(ctx: CoreContext, fn: Service<T>) {
  useLogger().withFields({ fn: fn.name }).log('Register service')
  return fn(ctx)
}
