import type { ConnectionEvent } from './services/connection'
import type { ChatEvent } from './services/dialogs'
import type { MessageEvent } from './services/messages'

import { EventEmitter } from 'eventemitter3'

export type CoreEvent =
  | MessageEvent
  | ChatEvent
  | ConnectionEvent

export type CoreEmitter = EventEmitter<CoreEvent>

export function createClient(): CoreEmitter {
  const eventEmitter = new EventEmitter<CoreEvent>()

  return eventEmitter
}
