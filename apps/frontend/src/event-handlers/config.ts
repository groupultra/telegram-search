import type { WsEventToClient } from '@tg-search/server'
import type { WsEventHandler } from '../composables/useWebsocketV2'

import { useSettingsStore } from '../store/useSettings'

export function registerConfigEventHandlers(
  registerEventHandler: <T extends keyof WsEventToClient>(event: T, handler: WsEventHandler<T>) => void,
) {
  const settingsStore = useSettingsStore()

  registerEventHandler('config:data', (data) => {
    settingsStore.config = data.config
  })
}
