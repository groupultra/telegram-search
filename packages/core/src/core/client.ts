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

export function useCoreClient() {
  const eventEmitter = new EventEmitter<CoreEvent>()

  function useService<T>(fn: Service<T>) {
    return fn(eventEmitter)
  }

  return {
    emitter: eventEmitter,
    useService,
  }
}
