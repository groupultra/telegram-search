import type { CorePagination } from '@tg-search/common/utils/pagination'
import type { CoreMessage } from '@tg-search/core'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { MessageWindow } from '../composables/useMessageWindow'
import { createMediaBlob } from '../utils/blob'
import { useWebsocketStore } from './useWebsocket'

export const useMessageStore = defineStore('message', () => {
  const currentChatId = ref<string>()
  const messageWindow = ref<MessageWindow>()

  const websocketStore = useWebsocketStore()

  async function pushMessages(messages: CoreMessage[]) {
    const filteredMessages = messages.filter(msg => msg.chatId === currentChatId.value)

    // eslint-disable-next-line no-console
    console.log(`[MessageStore] Push ${filteredMessages.length} messages`, filteredMessages)
    messageWindow.value!.addBatch(
      filteredMessages.map(message => ({
        ...message,
        media: message.media?.map(createMediaBlob),
      })),
    )
  }

  function useFetchMessages(chatId: string, limit: number) {
    // Cleanup message window
    currentChatId.value = chatId
    messageWindow.value?.clear()
    messageWindow.value = new MessageWindow(limit)

    const isLoading = ref(false)

    function fetchMessages(pagination: CorePagination) {
      isLoading.value = true

      // eslint-disable-next-line no-console
      console.log(`[MessageStore] Fetching messages for chat ${chatId}`, pagination.offset)

      // First, fetch the messages from database
      // if (useSettingsStore().useCachedMessage) {
      //   websocketStore.sendEvent('storage:fetch:messages', { chatId, pagination })
      // }

      // Then, fetch the messages from server & update the cache
      websocketStore.sendEvent('message:fetch', { chatId, pagination })

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
