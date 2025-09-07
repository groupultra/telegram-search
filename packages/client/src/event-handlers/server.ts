import type { ClientRegisterEventHandler } from '.'

import { toast } from 'vue-sonner'

import { useBridgeStore } from '../composables/useBridge'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('server:connected', (data) => {
    useBridgeStore().updateActiveSession(data.sessionId, { isConnected: data.connected })
  })

  registerEventHandler('server:error', ({ error }) => {
    // TODO: move it to view layer
    toast.error(String(error))
  })
}
