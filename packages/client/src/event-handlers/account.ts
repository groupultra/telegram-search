import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'

import { useAccountStore } from '../stores/useAccount'

export function registerAccountEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('account:ready', () => {
    useLogger('AccountEventHandlers').verbose('Account ready')
    useAccountStore().markReady()
  })

  registerEventHandler('config:data', ({ accountSettings }) => {
    useLogger('AccountEventHandlers').withFields({ ...accountSettings }).verbose('Received config data')
    useAccountStore().accountSettings = accountSettings
  })
}
