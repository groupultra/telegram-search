import type { ClientRegisterEventHandler } from '.'

import { toast } from 'vue-sonner'

import { useSessionStore } from '../store/useSession'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const connectionStore = useSessionStore()

  registerEventHandler('server:connected', (data) => {
    connectionStore.updateActiveSession(data.sessionId, { isConnected: data.connected })
  })

  registerEventHandler('server:error', ({ error }) => {
    // TODO: move it to view layer
    toast.error(String(error))
  })
}
