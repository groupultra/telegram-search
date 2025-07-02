import type { ClientRegisterEventHandler } from '.'

import { useSettingsStore } from '../stores/useSettings'

export function registerConfigEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('config:data', (data) => {
    useSettingsStore().config = data.config
  })
}
