import type { ClientRegisterEventHandler } from '.'

import { useSyncTaskStore } from '../stores/useSyncTask'

export function registerTakeoutEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('takeout:task:progress', (data) => {
    useSyncTaskStore().currentTask = data
  })

  registerEventHandler('takeout:stats:data', (data) => {
    useSyncTaskStore().chatStats = data
  })
}
