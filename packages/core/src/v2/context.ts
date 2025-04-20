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

export type FormCoreEvent = ClientInstanceEventFromCore
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

export type CoreEvent = FormCoreEvent & ToCoreEvent

export type CoreEventData<T> = T extends (data: infer D) => void ? D : never

export type CoreEmitter = EventEmitter<CoreEvent>

export type Service<T> = (ctx: CoreContext) => T

export type CoreContext = ReturnType<typeof createCoreContext>

export function createCoreContext() {
  const emitter = new EventEmitter<CoreEvent>()
  const withError = createErrorHandler(emitter)

  let telegramClient: TelegramClient

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
    setClient,
    getClient: ensureClient,
    withError,
  }
}

export function useService<T>(ctx: CoreContext, fn: Service<T>) {
  useLogger().withFields({ fn: fn.name }).debug('Register service')
  return fn(ctx)
}
