import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType, normalizeAccountSettings } from '@tg-search/core'

import { useAccountStore } from '../stores/useAccount'

export function registerAccountEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler(CoreEventType.AccountReady, () => {
    useLogger('AccountEventHandlers').verbose('Account ready')
    useAccountStore().markReady()
  })

  registerEventHandler(CoreEventType.ConfigData, ({ accountSettings }) => {
    const normalizedSettings = normalizeAccountSettings(accountSettings)
    const accountStore = useAccountStore()

    useLogger('AccountEventHandlers').withFields({ ...normalizedSettings }).verbose('Received config data')
    accountStore.accountSettings = normalizedSettings
    accountStore.hasFetchedSettings = true
  })
}
