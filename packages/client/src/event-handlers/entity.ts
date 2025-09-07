import type { ClientRegisterEventHandler } from '.'

import { useBridgeStore } from '../composables/useBridge'

export function registerEntityEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('entity:me:data', (data) => {
    useBridgeStore().getActiveSession()!.me = data
  })
}
