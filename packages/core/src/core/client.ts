import type { TelegramClient } from 'telegram'
import type { ConnectionEvent } from './services/connection'
import type { DialogEvent } from './services/dialogs'
import type { MessageEvent } from './services/messages'
import type { TakeoutEvent } from './services/takeout'

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
  const eventEmitter = new EventEmitter<CoreEvent>()

  let telegramClient: TelegramClient | null = null

  function useService<T>(fn: Service<T>) {
    return fn(eventEmitter)
  }

  function setClient(client: TelegramClient | null) {
    telegramClient = client
  }

  return {
    emitter: eventEmitter,
    useService,
    client: telegramClient,
    setClient,
  }
}
