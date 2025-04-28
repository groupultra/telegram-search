import type { ClientRegisterEventHandler } from '.'

import { useSessionStore } from '../store/useSession'

export function registerAuthEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const connectionStore = useSessionStore()

  registerEventHandler('auth:code:needed', () => {
    connectionStore.auth.needCode = true
  })

  registerEventHandler('auth:password:needed', () => {
    connectionStore.auth.needPassword = true
  })

  registerEventHandler('auth:connected', () => {
    connectionStore.getActiveSession()!.isConnected = true
  })
}
