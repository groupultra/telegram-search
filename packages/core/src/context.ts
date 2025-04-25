import type { TelegramClient } from 'telegram'
import type { ClientInstanceEventFromCore, ClientInstanceEventToCore } from './instance'
import type { SessionEventFromCore, SessionEventToCore } from './services'
import type { ConnectionEventFromCore, ConnectionEventToCore } from './services/connection'
import type { DialogEventFromCore, DialogEventToCore } from './services/dialog'
import type { EntityEventFromCore, EntityEventToCore } from './services/entity'
import type { MessageEventFromCore, MessageEventToCore } from './services/message'
import type { TakeoutEventFromCore, TakeoutEventToCore } from './services/takeout'

import { useLogger } from '@tg-search/common'
import { EventEmitter } from 'eventemitter3'

import { createErrorHandler } from './utils/error-handler'

export type FromCoreEvent = ClientInstanceEventFromCore
  & MessageEventFromCore
  & DialogEventFromCore
  & ConnectionEventFromCore
  & TakeoutEventFromCore
  & SessionEventFromCore
  & EntityEventFromCore

export type ToCoreEvent = ClientInstanceEventToCore
  & MessageEventToCore
  & DialogEventToCore
  & ConnectionEventToCore
  & TakeoutEventToCore
  & SessionEventToCore
  & EntityEventToCore

export type CoreEvent = FromCoreEvent & ToCoreEvent

export type CoreEventData<T> = T extends (data: infer D) => void ? D : never

export type CoreEmitter = EventEmitter<CoreEvent>

export type Service<T> = (ctx: CoreContext) => T

export type CoreContext = ReturnType<typeof createCoreContext>

export function createCoreContext() {
  const emitter = new EventEmitter<CoreEvent>()
  const withError = createErrorHandler(emitter)
  let telegramClient: TelegramClient

  const toCoreEvents = new Set<keyof ToCoreEvent>()
  const fromCoreEvents = new Set<keyof FromCoreEvent>()

  const wrapEmitterOn = (emitter: CoreEmitter, fn: (event: keyof ToCoreEvent) => void) => {
    const _on = emitter.on.bind(emitter)

    emitter.on = (event, listener) => {
      if (toCoreEvents.has(event as keyof ToCoreEvent)) {
        return _on(event, listener)
      }

      useLogger().withFields({ event }).debug('Register to core event')

      toCoreEvents.add(event as keyof ToCoreEvent)
      fn(event as keyof ToCoreEvent)

      return _on(event, listener)
    }
  }

  const wrapEmitterEmit = (emitter: CoreEmitter, fn: (event: keyof FromCoreEvent) => void) => {
    const _emit = emitter.emit.bind(emitter)

    emitter.emit = (event, ...args) => {
      if (fromCoreEvents.has(event as keyof FromCoreEvent)) {
        return _emit(event, ...args)
      }

      useLogger().withFields({ event }).debug('Register from core event')

      fromCoreEvents.add(event as keyof FromCoreEvent)
      fn(event as keyof FromCoreEvent)

      return _emit(event, ...args)
    }
  }

  function setClient(client: TelegramClient) {
    useLogger().debug('Setted Telegram client')
    telegramClient = client
  }

  function ensureClient(): TelegramClient {
    if (!telegramClient) {
      throw withError('Telegram client not set')
    }

    return telegramClient
  }

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
  useLogger().withFields({ fn: fn.name }).debug('Register service')
  return fn(ctx)
}
