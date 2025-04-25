import type { WsEventToClient } from '@tg-search/server'
import type { EventHandler } from '../composables/useWebsocketV2'

import { storeToRefs } from 'pinia'

import { useSyncTaskStore } from '../store/useSyncTask'

export function registerTakeoutEventHandlers(
  registerEventHandler: <T extends keyof WsEventToClient>(event: T, handler: EventHandler<T>) => void,
) {
  registerEventHandler('takeout:task:progress', (data) => {
    const { currentTask } = storeToRefs(useSyncTaskStore())
    currentTask.value = data
  })
}
