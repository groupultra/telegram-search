import type { ClientRegisterEventHandler } from '.'

export function registerConfigEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  // FIXME: deprecated
  registerEventHandler('config:data', (_data) => {
    // useSettingsStore().config = data.config
  })
}
