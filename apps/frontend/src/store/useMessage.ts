import type { CoreMessage, CorePagination } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { useWebsocketStore } from './useWebsocket'

export const useMessageStore = defineStore('message', () => {
  const messagesByChat = ref<Map<string, Map<string, CoreMessage>>>(new Map())
  const isLoadingMessages = ref(false)
  const loadingMessage = ref('')

  const websocketStore = useWebsocketStore()

  async function pushMessages(messages: CoreMessage[]) {
    messages.forEach((message) => {
      const { chatId } = message

      if (messagesByChat.value.has(chatId)) {
        messagesByChat.value.get(chatId)!.set(message.platformMessageId, message)
      }
      else {
        messagesByChat.value.set(chatId, new Map())
      }
    })
  }

  async function fetchMessagesWithDatabase(chatId: string, pagination: CorePagination) {
    try {
      isLoadingMessages.value = true
      loadingMessage.value = '从数据库加载消息中...'
      
      websocketStore.sendEvent('storage:fetch:messages', { chatId, pagination })
      const { messages: dbMessages } = await websocketStore.waitForEvent('storage:messages')

      const restMessageLength = pagination.limit - dbMessages.length
      // eslint-disable-next-line no-console
      console.log(`[MessageStore] Fetched ${dbMessages.length} messages from database, rest messages length ${restMessageLength}`)

      if (restMessageLength > 0) {
        pagination.offset += dbMessages.length
        loadingMessage.value = '从服务器获取更多消息中...'
        websocketStore.sendEvent('message:fetch', { chatId, pagination })
      }
      
      return dbMessages
    }
    catch (error) {
      toast.error('加载消息失败')
      console.error('[MessageStore] Error fetching messages', error)
      throw error
    }
    finally {
      isLoadingMessages.value = false
      loadingMessage.value = ''
    }
  }

  return {
    messagesByChat,
    isLoadingMessages,
    loadingMessage,
    pushMessages,
    fetchMessagesWithDatabase,
  }
})
