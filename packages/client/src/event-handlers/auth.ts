import type { ClientRegisterEventHandler } from '.'

import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import { useBridgeStore } from '../composables/useBridge'
import { useAuthStore } from '../stores/useAuth'

export function registerBasicEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('auth:code:needed', () => {
    useAuthStore().auth.needCode = true
  })

  registerEventHandler('auth:password:needed', () => {
    useAuthStore().auth.needPassword = true
  })

  registerEventHandler('auth:connected', () => {
    useBridgeStore().getActiveSession()!.isConnected = true
  })

  // Core forwards updated StringSession to the client; store it on the active session.
  registerEventHandler('session:update', ({ session }) => {
    const bridgeStore = useBridgeStore()
    const { activeSessionId } = storeToRefs(bridgeStore)
    bridgeStore.updateActiveSession(activeSessionId.value, { session })
  })

  registerEventHandler('auth:error', ({ error }) => {
    // TODO better toast error message
    toast.error(JSON.stringify(error))
    useAuthStore().auth.isLoading = false
  })
}
