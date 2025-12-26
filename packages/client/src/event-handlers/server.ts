import type { ClientRegisterEventHandler } from '.'

import { toast } from 'vue-sonner'

import { useAccountStore } from '../stores/useAccount'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('server:connected', (data) => {
    // server:connected carries the authoritative connection state for a
    // specific sessionId.
    if (data.accountReady) {
      useAccountStore().markReady()
    }
    else {
      useAccountStore().resetReady()
    }
  })

  registerEventHandler('core:error', ({ error, description }) => {
    // TODO: move it to view layer
    toast.error(error, { description })
  })
}
