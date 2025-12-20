import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { toast } from 'vue-sonner'

import { useBridgeStore } from '../composables/useBridge'
import { useAccountStore } from '../stores/useAccount'

export function registerBasicEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('auth:code:needed', () => {
    useAccountStore().auth.needCode = true
  })

  registerEventHandler('auth:password:needed', () => {
    useAccountStore().auth.needPassword = true
  })

  registerEventHandler('auth:connected', () => {
    const store = useBridgeStore()
    if (store.activeSession) {
      store.activeSession = { ...store.activeSession, isReady: true }
    }
  })

  registerEventHandler('auth:disconnected', () => {
    useLogger('Auth').log('Auth disconnected, cleaning up session metadata')
    const store = useBridgeStore()
    if (store.activeSession) {
      store.activeSession = { ...store.activeSession, isReady: false, session: undefined }
    }
  })

  // Core forwards updated StringSession to the client; let bridge store decide
  // whether to update current account or create a new slot (add-account flow).
  registerEventHandler('session:update', ({ session }) => {
    // session:update always applies to the currently active slot. The
    // auth flow is responsible for selecting the correct active account
    // before initiating login.
    const store = useBridgeStore()
    if (store.activeSession) {
      store.activeSession = { ...store.activeSession, session }
    }
  })

  registerEventHandler('auth:error', ({ error }) => {
    // TODO better toast error message
    toast.error(String(error))
    useAccountStore().auth.isLoading = false
  })
}
