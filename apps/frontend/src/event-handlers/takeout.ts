import type { ClientRegisterEventHandler } from '.'

import { storeToRefs } from 'pinia'

import { useSyncTaskStore } from '../store/useSyncTask'

export function registerTakeoutEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('takeout:task:progress', (data) => {
    const { currentTask } = storeToRefs(useSyncTaskStore())
    currentTask.value = data
  })
}
