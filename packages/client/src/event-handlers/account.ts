import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'

import { useAccountStore } from '../stores/useAccount'
import { useBootstrapStore } from '../stores/useBootstrap'

export function registerAccountEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('account:ready', () => {
    useLogger('AccountEventHandlers').verbose('Account ready')
    useAccountStore().markReady()

    // Now that core has recorded the account and set currentAccountId,
    // signal frontend bootstrap that the account context is ready. This
    // will perform client-side post-bootstrap work (e.g. hydrate dialogs).
    useBootstrapStore().markAccountReady()
  })

  registerEventHandler('config:data', ({ accountSettings }) => {
    useLogger('AccountEventHandlers').withFields({ ...accountSettings }).verbose('Received config data')
    useAccountStore().accountSettings = accountSettings
  })
}
