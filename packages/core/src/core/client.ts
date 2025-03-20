import type { TelegramClient } from 'telegram'
import type { ConnectionEvent } from './services/connection'
import type { DialogEvent } from './services/dialogs'
import type { MessageEvent } from './services/messages'
import type { TakeoutEvent } from './services/takeout'

import { useLogger } from '@tg-search/common'
import { EventEmitter } from 'eventemitter3'

export type CoreEvent =
  & MessageEvent
  & DialogEvent
  & ConnectionEvent
  & TakeoutEvent

export type CoreEmitter = EventEmitter<CoreEvent>

export type Service<T> = (emitter: CoreEmitter) => T

export type CoreContext = ReturnType<typeof useCoreContext>

export function useCoreContext() {
  const logger = useLogger()
  const emitter = new EventEmitter<CoreEvent>()
  let telegramClient: TelegramClient | null = null

  function useService<T>(fn: Service<T>) {
    logger.withFields({ fn: fn.name }).debug('Register service')
    return fn(emitter)
  }

  function setClient(client: TelegramClient | null) {
    telegramClient = client
  }

  return {
    emitter,
    useService,
    client: telegramClient,
    setClient,
  }
}
