import type { ChatSyncStats, CoreTaskData } from '@tg-search/core'

import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useSyncTaskStore = defineStore('sync-task', () => {
  const increase = ref(false)
  const currentTask = ref<CoreTaskData<'takeout'>>()
  const chatStats = ref<ChatSyncStats>()
  const chatStatsLoading = ref(false)
  const initialSyncedMessages = ref<number>(0)
  const etaSeconds = ref<number | null>(null)

  const currentTaskProgress = computed(() => {
    if (!currentTask.value)
      return 0

    return currentTask.value.progress
  })

  return {
    currentTask,
    currentTaskProgress,
    increase,
    chatStats,
    chatStatsLoading,
    initialSyncedMessages,
    etaSeconds,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSyncTaskStore, import.meta.hot))
}
