import type { ClientRegisterEventHandlerFn } from './index'

import { CoreEventType } from '@tg-search/core'

import { useAccountStore } from '../stores/useAccount'

export function registerSyncEventHandlers(registerEventHandler: ClientRegisterEventHandlerFn) {
  registerEventHandler(CoreEventType.SyncStatus, (data) => {
    const accountStore = useAccountStore()
    accountStore.syncStatus = data.status
  })
}
