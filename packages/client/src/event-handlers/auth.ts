import type { ClientRegisterEventHandler } from '.'

import { toast } from 'vue-sonner'

import { useAuthStore } from '../stores/useAuth'
import { useBridgeStore } from '../stores/useBridge'

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

  registerEventHandler('auth:error', ({ error }) => {
    // TODO better toast error message
    toast.error(JSON.stringify(error))
    useAuthStore().auth.isLoading = false
  })
}
