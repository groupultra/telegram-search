import type { TelegramClient } from 'telegram'
import type { ClientEvent } from './client'
import type { SessionEvent } from './services'
import type { ConnectionEvent } from './services/connection'
import type { DialogEvent } from './services/dialogs'
import type { MessageEvent } from './services/messages'
import type { TakeoutEvent } from './services/takeout'

import { useLogger } from '@tg-search/common'
import { EventEmitter } from 'eventemitter3'

import { createErrorHandler } from './utils/error-handler'

export type CoreEvent = ClientEvent
  & MessageEvent
  & DialogEvent
  & ConnectionEvent
  & TakeoutEvent
  & SessionEvent

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

  function getClient(): TelegramClient | null {
    if (!telegramClient) {
      return null
    }

    return telegramClient
  }

  return {
    emitter,
    setClient,
    getClient,
    withError,
  }
}

export function useService<T>(ctx: CoreContext, fn: Service<T>) {
  useLogger().withFields({ fn: fn.name }).debug('Register service')
  return fn(ctx)
}
