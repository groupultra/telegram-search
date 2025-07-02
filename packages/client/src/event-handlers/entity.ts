import type { ClientRegisterEventHandler } from '.'

import { useWebsocketStore } from '../stores/useWebsocket'

export function registerEntityEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('entity:me:data', (data) => {
    useWebsocketStore().getActiveSession()!.me = data
  })
}
