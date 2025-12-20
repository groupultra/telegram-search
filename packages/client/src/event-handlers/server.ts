import type { ClientRegisterEventHandler } from '.'

import { toast } from 'vue-sonner'

import { useBridgeStore } from '../composables/useBridge'
import { useAccountStore } from '../stores/useAccount'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('server:connected', (data) => {
    // server:connected carries the authoritative connection state for a
    // specific sessionId. We update that slot directly without creating
    // any new accounts.
    useBridgeStore().updateSession(data.sessionId, s => ({ ...s, isReady: data.accountReady }))

    if (data.accountReady) {
      useAccountStore().markReady()
    }
  })

  registerEventHandler('core:error', ({ error, description }) => {
    // TODO: move it to view layer
    toast.error(error, { description })
  })
}
