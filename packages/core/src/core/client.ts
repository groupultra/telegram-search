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

export function createClient(): CoreEmitter {
  const eventEmitter = new EventEmitter<CoreEvent>()

  return eventEmitter
}
