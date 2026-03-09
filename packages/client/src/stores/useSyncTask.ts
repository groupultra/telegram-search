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
  /** True when core is waiting for the user to choose takeout vs GetHistory. */
  const takeoutConfirmNeeded = ref(false)

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
    takeoutConfirmNeeded,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSyncTaskStore, import.meta.hot))
}
