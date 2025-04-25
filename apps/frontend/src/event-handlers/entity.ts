import type { WsEventToClient } from '@tg-search/server'
import type { EventHandler } from '../composables/useWebsocketV2'

import { useSessionStore } from '../store/useSessionV2'

export function registerEntityEventHandlers(
  registerEventHandler: <T extends keyof WsEventToClient>(event: T, handler: EventHandler<T>) => void,
) {
  const connectionStore = useSessionStore()

  registerEventHandler('entity:me', (data) => {
    connectionStore.getActiveSession()!.me = data
  })
}
