import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import { useAccountStore } from '../stores/useAccount'

export function registerBasicEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const accountStore = useAccountStore()
  const { activeSession } = storeToRefs(accountStore)

  registerEventHandler('auth:code:needed', () => {
    useAccountStore().auth.needCode = true
  })

  registerEventHandler('auth:password:needed', () => {
    useAccountStore().auth.needPassword = true
  })

  registerEventHandler('auth:connected', () => {
    if (activeSession.value) {
      activeSession.value.isReady = true
    }
  })

  registerEventHandler('auth:disconnected', () => {
    useLogger('Auth').log('Auth disconnected, cleaning up session metadata')
    if (activeSession.value) {
      activeSession.value.isReady = false
      activeSession.value.session = undefined
    }
  })

  // Core forwards updated StringSession to the client; let bridge store decide
  // whether to update current account or create a new slot (add-account flow).
  registerEventHandler('session:update', ({ session: sessionString }) => {
    if (activeSession.value) {
      activeSession.value.session = sessionString
    }
  })

  registerEventHandler('auth:error', ({ error }) => {
    // TODO better toast error message
    toast.error(String(error))
    useAccountStore().auth.isLoading = false
  })
}
