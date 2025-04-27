import type { WsEventToClient } from '@tg-search/server'
import type { WsEventHandler } from '../composables/useWebsocketV2'

import { useSessionStore } from '../store/useSessionV2'

export function registerServerEventHandlers(
  registerEventHandler: <T extends keyof WsEventToClient>(event: T, handler: WsEventHandler<T>) => void,
) {
  const connectionStore = useSessionStore()

  registerEventHandler('server:connected', (data) => {
    connectionStore.setActiveSession(data.sessionId, { isConnected: data.connected })
  })
}
