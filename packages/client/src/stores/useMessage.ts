import type { CorePagination } from '@tg-search/common/utils/pagination'
import type { CoreMessage } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { createMediaBlob } from '../utils/blob'
import { useSettingsStore } from './useSettings'
import { useWebsocketStore } from './useWebsocket'

export const useMessageStore = defineStore('message', () => {
  // TODO: performance, LRU cache or shallow ref, vertical view
  const messagesByChat = ref<Map<string, Map<string, CoreMessage>>>(new Map())

  const websocketStore = useWebsocketStore()

  function useMessageChatMap(chatId: string) {
    if (!messagesByChat.value.has(chatId)) {
      messagesByChat.value.set(chatId, new Map())
    }

    return messagesByChat.value.get(chatId)!
  }

  async function pushMessages(messages: CoreMessage[]) {
    messages.forEach((message) => {
      const { chatId } = message

      const chatMap = useMessageChatMap(chatId)

      message.media = message.media?.map(createMediaBlob)

      chatMap.set(message.platformMessageId, message)
    })
  }

  function useFetchMessages(chatId: string) {
    const isLoading = ref(false)

    function fetchMessages(pagination: CorePagination) {
      toast.promise(async () => {
        isLoading.value = true

        // First, fetch the messages from database
        if (useSettingsStore().useCachedMessage) {
          toast.promise(async () => {
            websocketStore.sendEvent('storage:fetch:messages', { chatId, pagination })
          }, {
            loading: 'Fetching messages from server...',
          })
        }

        // Then, fetch the messages from server & update the cache
        toast.promise(async () => {
          websocketStore.sendEvent('message:fetch', { chatId, pagination })
        }, {
          loading: 'Fetching messages from server...',
        })

        await Promise.race([
          websocketStore.waitForEvent('message:data'),
          websocketStore.waitForEvent('storage:messages'),
        ])
      }, {
        loading: 'Loading messages from database...',
        success: 'Messages loaded',
        error: 'Error loading messages',
        finally() {
          isLoading.value = false
        },
      })
    }

    return {
      isLoading,
      fetchMessages,
    }
  }

  return {
    messagesByChat,
    pushMessages,
    useMessageChatMap,
    useFetchMessages,
  }
})
