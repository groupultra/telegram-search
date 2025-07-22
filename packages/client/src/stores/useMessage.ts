import type { CorePagination } from '@tg-search/common/utils/pagination'
import type { CoreMessage } from '@tg-search/core'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { MessageWindow } from '../composables/useMessageWindow'
import { createMediaBlob } from '../utils/blob'
import { determineMessageDirection } from '../utils/message'
import { useWebsocketStore } from './useWebsocket'

function createContextWithTimeout(timeout: number) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout),
  )
}

export const useMessageStore = defineStore('message', () => {
  const currentChatId = ref<string>()
  const messageWindow = ref<MessageWindow>()

  const websocketStore = useWebsocketStore()

  async function pushMessages(messages: CoreMessage[]) {
    const filteredMessages = messages.filter(msg => msg.chatId === currentChatId.value)

    const direction = determineMessageDirection(filteredMessages, messageWindow.value)

    // eslint-disable-next-line no-console
    console.log(`[MessageStore] Push ${filteredMessages.length} messages (${direction})`, filteredMessages)

    messageWindow.value!.addBatch(
      filteredMessages.map(message => ({
        ...message,
        media: message.media?.map(createMediaBlob),
      })),
      direction,
    )
  }

  function useFetchMessages(chatId: string, limit: number) {
    // Only initialize if chatId changes
    if (currentChatId.value !== chatId) {
      currentChatId.value = chatId
      messageWindow.value?.clear()
      messageWindow.value = new MessageWindow(limit)
    }

    const isLoading = ref(false)

    function fetchMessages(
      pagination: CorePagination & {
        minId?: number
      },
      direction: 'older' | 'newer' = 'older',
    ) {
      isLoading.value = true

      // eslint-disable-next-line no-console
      console.log(`[MessageStore] Fetching messages for chat ${chatId}`, pagination.offset)

      // Then, fetch the messages from server & update the cache
      switch (direction) {
        case 'older':
          websocketStore.sendEvent('message:fetch', { chatId, pagination })
          break
        case 'newer':
          websocketStore.sendEvent('message:fetch', {
            chatId,
            pagination: {
              offset: 0,
              limit: pagination.limit,
            },
            minId: pagination.minId,
          })
          break
      }

      Promise.race([
        websocketStore.waitForEvent('message:data'),
        websocketStore.waitForEvent('storage:messages'),
        createContextWithTimeout(10000),
      ]).then(() => {
        isLoading.value = false
      }).catch(() => {
        // Handle errors and reset loading state
        isLoading.value = false
        console.warn('[MessageStore] Message fetch timed out or failed')
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
    sortedMessageArray: computed(() => messageWindow.value?.getSortedIds().map(id => messageWindow.value?.get(id)).filter(Boolean) ?? []),
    messageWindow,

    pushMessages,
    useFetchMessages,
  }
})
