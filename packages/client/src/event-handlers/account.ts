import type { ClientRegisterEventHandler } from '.'

import { useAccountStore } from '../stores/useAccount'

export function registerAccountEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('account:ready', () => {
    useAccountStore().markReady()
  })

  registerEventHandler('config:data', ({ accountSettings }) => {
    useAccountStore().accountSettings = accountSettings
  })
}
