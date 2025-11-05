import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  retrievedMessages?: CoreRetrievalMessages[]
  isStreaming?: boolean
}

export const useAIChatStore = defineStore('aiChat', () => {
  const messages = ref<AIChatMessage[]>([])
  const isLoading = ref(false)
  const isSearching = ref(false)
  const error = ref<string | null>(null)

  function addUserMessage(content: string): string {
    const id = `user-${Date.now()}`
    messages.value.push({
      id,
      role: 'user',
      content,
      timestamp: Date.now(),
    })
    return id
  }

  function addAssistantMessage(initialContent = ''): string {
    const id = `assistant-${Date.now()}`
    messages.value.push({
      id,
      role: 'assistant',
      content: initialContent,
      timestamp: Date.now(),
      isStreaming: true,
    })
    return id
  }

  function updateAssistantMessage(id: string, content: string, retrievedMessages?: CoreRetrievalMessages[]) {
    const message = messages.value.find(msg => msg.id === id)
    if (message) {
      message.content = content
      if (retrievedMessages) {
        message.retrievedMessages = retrievedMessages
      }
    }
  }

  function completeAssistantMessage(id: string) {
    const message = messages.value.find(msg => msg.id === id)
    if (message) {
      message.isStreaming = false
    }
  }

  function setError(errorMessage: string) {
    error.value = errorMessage
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setSearching(searching: boolean) {
    isSearching.value = searching
  }

  function clearChat() {
    messages.value = []
    error.value = null
    isLoading.value = false
    isSearching.value = false
  }

  function clearError() {
    error.value = null
  }

  return {
    messages,
    isLoading,
    isSearching,
    error,
    addUserMessage,
    addAssistantMessage,
    updateAssistantMessage,
    completeAssistantMessage,
    setError,
    setLoading,
    setSearching,
    clearChat,
    clearError,
  }
})
