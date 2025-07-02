import type { ClientRegisterEventHandler } from '.'

import { toast } from 'vue-sonner'

import { useWebsocketStore } from '../stores/useWebsocket'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('server:connected', (data) => {
    useWebsocketStore().updateActiveSession(data.sessionId, { isConnected: data.connected })
  })

  registerEventHandler('server:error', ({ error }) => {
    // TODO: move it to view layer
    toast.error(String(error))
  })
}
