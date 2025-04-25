import type { WsEventToClient } from '@tg-search/server'
import type { WsEventHandler } from '../composables/useWebsocketV2'

import { useSessionStore } from '../store/useSessionV2'

export function registerAuthEventHandlers(
  registerEventHandler: <T extends keyof WsEventToClient>(event: T, handler: WsEventHandler<T>) => void,
) {
  const connectionStore = useSessionStore()

  registerEventHandler('auth:needCode', () => {
    connectionStore.auth.needCode = true
  })

  registerEventHandler('auth:needPassword', () => {
    connectionStore.auth.needPassword = true
  })

  registerEventHandler('auth:connected', () => {
    connectionStore.getActiveSession()!.isConnected = true
  })
}
