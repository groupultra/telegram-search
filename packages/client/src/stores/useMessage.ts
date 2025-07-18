import type { CorePagination } from '@tg-search/common/utils/pagination'
import type { CoreMessage } from '@tg-search/core'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { MessageWindow } from '../composables/useMessageWindow'
import { createMediaBlob } from '../utils/blob'
import { useSettingsStore } from './useSettings'
import { useWebsocketStore } from './useWebsocket'

export const useMessageStore = defineStore('message', () => {
  // Replace Map with MessageWindow for each chat
  const currentChatId = ref<string>()
  const messageWindow = ref<MessageWindow>()

  const websocketStore = useWebsocketStore()

  async function pushMessages(messages: CoreMessage[]) {
    messageWindow.value!.addBatch(
      messages.map(message => ({
        ...message,
        media: message.media?.map(createMediaBlob),
      })),
    )
  }

  function useFetchMessages(chatId: string) {
    // Cleanup message window
    currentChatId.value = chatId
    messageWindow.value = new MessageWindow(50)

    const isLoading = ref(false)

    function fetchMessages(pagination: CorePagination) {
      isLoading.value = true

      // First, fetch the messages from database
      if (useSettingsStore().useCachedMessage) {
        websocketStore.sendEvent('storage:fetch:messages', { chatId, pagination })
      }

      // FIXME: Then, fetch the messages from server & update the cache
      // websocketStore.sendEvent('message:fetch', { chatId, pagination })

      // Trigger isLoading to false
      Promise.race([
        websocketStore.waitForEvent('message:data'),
        websocketStore.waitForEvent('storage:messages'),
      ]).then(() => {
        isLoading.value = false
      })
    }

    return {
      isLoading,
      fetchMessages,
    }
  }

  return {
    chatId: computed(() => currentChatId),
    sortedMessageIds: computed(() => messageWindow.value?.getSortedIds() ?? []),
    messageWindow,

    pushMessages,
    useFetchMessages,
  }
})
