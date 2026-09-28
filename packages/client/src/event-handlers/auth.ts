import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'

import { useAccountStore } from '../stores/useAccount'
import { useSessionStore } from '../stores/useSession'

export function registerBasicEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const logger = useLogger('Auth')

  registerEventHandler(CoreEventType.AuthQrCode, data => useAccountStore().qrLogin.receiveCode(data))
  registerEventHandler(CoreEventType.AuthQrState, data => useAccountStore().qrLogin.receiveState(data))

  registerEventHandler(CoreEventType.AuthCodeNeeded, () => {
    useAccountStore().auth.needCode = true
    useAccountStore().auth.isLoading = false
  })

  registerEventHandler(CoreEventType.AuthPasswordNeeded, () => {
    useAccountStore().auth.needPassword = true
    useAccountStore().auth.isLoading = false
  })

  registerEventHandler(CoreEventType.AuthConnected, () => {
    useAccountStore().qrLogin.clear()
    logger.log('Auth connected')
  })

  registerEventHandler(CoreEventType.AuthDisconnected, () => {
    useAccountStore().qrLogin.cancel()
    logger.log('Auth disconnected, cleaning up session metadata')
    useAccountStore().resetReady()
  })

  // Core forwards updated StringSession to the client; let bridge store decide
  // whether to update current account or create a new slot (add-account flow).
  registerEventHandler(CoreEventType.SessionUpdate, ({ session: sessionString }) => {
    if (useSessionStore().activeSession) {
      useSessionStore().activeSession!.session = sessionString
    }
  })

  registerEventHandler(CoreEventType.AuthError, () => {
    useAccountStore().auth.isLoading = false
  })
}
