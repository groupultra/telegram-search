import type { ClientRegisterEventHandler } from '.'

import { useSessionStore } from '../store/useSession'

export function registerEntityEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const connectionStore = useSessionStore()

  registerEventHandler('entity:me:data', (data) => {
    connectionStore.getActiveSession()!.me = data
  })
}
