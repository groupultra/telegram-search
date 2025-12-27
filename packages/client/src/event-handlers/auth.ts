import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { storeToRefs } from 'pinia'

import { useAccountStore } from '../stores/useAccount'

export function registerBasicEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const logger = useLogger('Auth')

  registerEventHandler('auth:code:needed', () => {
    useAccountStore().auth.needCode = true
  })

  registerEventHandler('auth:password:needed', () => {
    useAccountStore().auth.needPassword = true
  })

  registerEventHandler('auth:connected', () => {
    logger.log('Auth connected')
  })

  registerEventHandler('auth:disconnected', () => {
    logger.log('Auth disconnected, cleaning up session metadata')
    useAccountStore().resetReady()
  })

  // Core forwards updated StringSession to the client; let bridge store decide
  // whether to update current account or create a new slot (add-account flow).
  registerEventHandler('session:update', ({ session: sessionString }) => {
    useSessionStore().activeSession.session = sessionString
  })

  registerEventHandler('auth:error', () => {
    useAccountStore().auth.isLoading = false
  })
}
