import type { ClientRegisterEventHandler } from '.'

import { useAuthStore } from '../stores/useAuth'
import { useWebsocketStore } from '../stores/useWebsocket'

export function registerAuthEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('auth:code:needed', () => {
    useAuthStore().auth.needCode = true
  })

  registerEventHandler('auth:password:needed', () => {
    useAuthStore().auth.needPassword = true
  })

  registerEventHandler('auth:connected', () => {
    useWebsocketStore().getActiveSession()!.isConnected = true
  })
}
