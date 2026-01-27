import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'

import { useAccountStore } from '../stores/useAccount'

export function registerAccountEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler(CoreEventType.AccountReady, () => {
    useLogger('AccountEventHandlers').verbose('Account ready')
    useAccountStore().markReady()
  })

  registerEventHandler(CoreEventType.ConfigData, ({ accountSettings }) => {
    useLogger('AccountEventHandlers').withFields({ ...accountSettings }).verbose('Received config data')
    useAccountStore().accountSettings = accountSettings
  })
}
