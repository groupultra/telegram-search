import type { ClientRegisterEventHandler } from '.'

import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import { useBootstrapStore } from '../stores'
import { useAccountStore } from '../stores/useAccount'
import { useSessionStore } from '../stores/useSession'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('server:connected', (data) => {
    // server:connected carries the authoritative connection state for a
    // specific sessionId. We update that slot directly without creating
    // any new accounts.
    const { activeSession } = storeToRefs(useSessionStore())
    if (activeSession.value) {
      activeSession.value.isReady = data.accountReady
    }

    if (data.accountReady) {
      useAccountStore().markReady()
      useBootstrapStore().markAccountReady()
    }
  })

  registerEventHandler('core:error', ({ error, description }) => {
    // TODO: move it to view layer
    toast.error(error, { description })
  })
}
