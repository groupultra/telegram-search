import type { CorePagination } from '@tg-search/common/utils/pagination'
import type { CoreMessage } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { MessageWindow } from '../composables/useMessageWindow'
import { createMediaBlob } from '../utils/blob'
import { useSettingsStore } from './useSettings'
import { useWebsocketStore } from './useWebsocket'

export const useMessageStore = defineStore('message', () => {
  // Replace Map with MessageWindow for each chat
  const messageWindows = ref<Map<string, MessageWindow>>(new Map())

  const websocketStore = useWebsocketStore()

  function getMessageWindow(chatId: string) {
    if (!messageWindows.value.has(chatId)) {
      messageWindows.value.set(chatId, new MessageWindow(50)) // 50 messages max
    }
    return messageWindows.value.get(chatId)!
  }

  // Compatibility function for existing code
  function useMessageChatMap(chatId: string) {
    const window = getMessageWindow(chatId)
    // Return the underlying Map for compatibility
    return window.messages
  }

  async function pushMessages(messages: CoreMessage[]) {
    // Group messages by chatId
    const messagesByChat = new Map<string, CoreMessage[]>()

    messages.forEach((message) => {
      const { chatId } = message

      // Process media
      message.media = message.media?.map(createMediaBlob)

      if (!messagesByChat.has(chatId)) {
        messagesByChat.set(chatId, [])
      }
      messagesByChat.get(chatId)!.push(message)
    })

    // Add messages to their respective windows
    messagesByChat.forEach((chatMessages, chatId) => {
      const window = getMessageWindow(chatId)
      window.addBatch(chatMessages)
    })
  }

  function useFetchMessages(chatId: string) {
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
    messagesByChat: messageWindows,
    pushMessages,
    useMessageChatMap,
    useFetchMessages,

    // Message Window
    getMessageWindow,
  }
})
