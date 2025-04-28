import type { ClientRegisterEventHandler } from '.'

import { useSessionStore } from '../store/useSession'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const connectionStore = useSessionStore()

  registerEventHandler('server:connected', (data) => {
    connectionStore.updateActiveSession(data.sessionId, { isConnected: data.connected })
  })
}
