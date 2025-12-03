import type { ClientRegisterEventHandlerFn } from './index'

import { registerConfigEventHandlers } from './account-settings'
import { registerBasicEventHandlers } from './auth'
import { registerDialogEventHandlers } from './dialog'
import { registerEntityEventHandlers } from './entity'
import { registerMessageEventHandlers } from './message'
import { registerServerEventHandlers } from './server'
import { registerStorageEventHandlers } from './storage'
import { registerTakeoutEventHandlers } from './takeout'

export function registerAllEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  registerServerEventHandlers(registerEventHandler)
  registerBasicEventHandlers(registerEventHandler)
  registerEntityEventHandlers(registerEventHandler)
  registerTakeoutEventHandlers(registerEventHandler)
  registerConfigEventHandlers(registerEventHandler)
  registerDialogEventHandlers(registerEventHandler)
  registerStorageEventHandlers(registerEventHandler)
  registerMessageEventHandlers(registerEventHandler)
}
