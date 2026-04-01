import type { ClientRegisterEventHandler } from '.'

import { CoreEventType } from '@tg-search/core'

import { useSyncTaskStore } from '../stores/useSyncTask'

export function registerTakeoutEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler(CoreEventType.TakeoutConfirmNeeded, () => {
    useSyncTaskStore().takeoutConfirmNeeded = true
  })

  registerEventHandler(CoreEventType.TakeoutTaskProgress, (data) => {
    useSyncTaskStore().currentTask = data
  })

  registerEventHandler(CoreEventType.TakeoutStatsData, (data) => {
    const store = useSyncTaskStore()
    store.chatStatsByChatId = {
      ...store.chatStatsByChatId,
      [data.chatId]: data,
    }

    if (store.chatStatsFocusedChatId === data.chatId) {
      store.chatStats = data
      store.chatStatsLoading = false
    }
  })

  registerEventHandler(CoreEventType.TakeoutMetrics, (data) => {
    const store = useSyncTaskStore()
    if (store.currentTask && store.currentTask.taskId === data.taskId) {
      const currentChatId = store.currentTask.metadata.chatIds[0]
      const currentStats = store.chatStatsByChatId[currentChatId]
        ?? (store.chatStats?.chatId === currentChatId ? store.chatStats : undefined)

      if (!currentStats) {
        return
      }

      const initialSyncedMessages = store.currentTask.metadata.initialSyncedMessages ?? currentStats.syncedMessages
      const syncedMessages = initialSyncedMessages + data.processedCount
      const totalMessages = data.totalCount > 0 ? data.totalCount : currentStats.totalMessages
      const nextStats = {
        ...currentStats,
        syncedMessages,
        totalMessages,
      }

      store.chatStatsByChatId = {
        ...store.chatStatsByChatId,
        [currentChatId]: nextStats,
      }

      if (store.chatStatsFocusedChatId === currentChatId) {
        store.chatStats = nextStats
      }

      // Calculate ETA based on processing speed
      if (data.processSpeed > 0) {
        const remainingMessages = Math.max(0, totalMessages - syncedMessages)
        store.etaSeconds = Math.ceil(remainingMessages / data.processSpeed)
      }
      else {
        store.etaSeconds = null
      }
    }
  })
}
