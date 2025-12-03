import type { ClientRegisterEventHandler } from '.'

import { useAccountStore } from '../stores/useAccount'

export function registerConfigEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('config:data', ({ accountSettings }) => {
    useAccountStore().accountSettings = accountSettings
  })
}
