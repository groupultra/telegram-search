import type { ClientRegisterEventHandler } from '.'

import { CoreEventType } from '@tg-search/core'
import { toast } from 'vue-sonner'

import { useAccountStore } from '../stores/useAccount'
import { useSessionStore } from '../stores/useSession'

export function registerServerEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('server:connected', (data) => {
    if (data.sessionId !== useSessionStore().activeSessionId)
      return
    // server:connected carries the authoritative connection state for a
    // specific sessionId.
    if (data.accountReady) {
      useAccountStore().markReady()
    }
    else {
      useAccountStore().resetReady()
      useAccountStore().init()
    }
  })

  registerEventHandler(CoreEventType.CoreError, ({ error, description }) => {
    // TODO: move it to view layer
    toast.error(error, { description })
  })
}
