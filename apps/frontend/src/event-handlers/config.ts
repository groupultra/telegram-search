import type { ClientRegisterEventHandler } from '.'

import { useSettingsStore } from '../store/useSettings'

export function registerConfigEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const settingsStore = useSettingsStore()

  registerEventHandler('config:data', (data) => {
    settingsStore.config = data.config
  })
}
