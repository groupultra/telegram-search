import type { TelegramClient } from 'telegram'
import type { ClientEvent } from './client'
import type { ConnectionEvent } from './services/connection'
import type { DialogEvent } from './services/dialogs'
import type { MessageEvent } from './services/messages'
import type { TakeoutEvent } from './services/takeout'

import { useLogger } from '@tg-search/common'
import { EventEmitter } from 'eventemitter3'

export type CoreEvent = ClientEvent
  & MessageEvent
  & DialogEvent
  & ConnectionEvent
  & TakeoutEvent

export type CoreEventData<T> = T extends (data: infer D) => void ? D : never

export type CoreEmitter = EventEmitter<CoreEvent>

export type Service<T> = (emitter: CoreEmitter) => T

export type CoreContext = ReturnType<typeof createCoreContext>

export function createCoreContext() {
  const logger = useLogger()
  const emitter = new EventEmitter<CoreEvent>()
  let telegramClient: TelegramClient

  function useService<T>(fn: Service<T>) {
    logger.withFields({ fn: fn.name }).debug('Register service')
    return fn(emitter)
  }

  function setClient(client: TelegramClient) {
    telegramClient = client
  }

  function getClient() {
    return telegramClient
  }

  return {
    emitter,
    useService,
    setClient,
    getClient,
  }
}
