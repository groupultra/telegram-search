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
      }
    }
  })
}
