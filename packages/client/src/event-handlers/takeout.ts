import type { ClientRegisterEventHandler } from '.'

import { useSyncTaskStore } from '../stores/useSyncTask'

export function registerTakeoutEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('takeout:task:progress', (data) => {
    useSyncTaskStore().currentTask = data
  })

  registerEventHandler('takeout:stats:data', (data) => {
    const store = useSyncTaskStore()
    store.chatStats = data
    store.chatStatsLoading = false
    store.initialSyncedMessages = data.syncedMessages
  })

  registerEventHandler('takeout:metrics', (data) => {
    const store = useSyncTaskStore()
    if (store.currentTask && store.currentTask.taskId === data.taskId) {
      if (store.chatStats && store.currentTask.metadata.chatIds.includes(store.chatStats.chatId)) {
        store.chatStats.syncedMessages = store.initialSyncedMessages + data.processedCount
        if (data.totalCount > 0) {
          store.chatStats.totalMessages = data.totalCount
        }

        // Calculate ETA based on processing speed
        if (data.processSpeed > 0) {
          const remainingMessages = Math.max(0, store.chatStats.totalMessages - store.chatStats.syncedMessages)
          store.etaSeconds = Math.ceil(remainingMessages / data.processSpeed)
        }
        else {
          store.etaSeconds = null
        }
      }
    }
  })
}
