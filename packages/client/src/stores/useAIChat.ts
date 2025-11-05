import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  retrievedMessages?: CoreRetrievalMessages[]
}

export const useAIChatStore = defineStore('aiChat', () => {
  const messages = ref<AIChatMessage[]>([])
  const isLoading = ref(false)
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

  function handleAIResponse(response: string, retrievedMessages: CoreRetrievalMessages[]) {
    isLoading.value = false
    error.value = null

    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
      retrievedMessages,
    })
  }

  function handleError(errorMessage: string) {
    isLoading.value = false
    error.value = errorMessage
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function clearChat() {
    messages.value = []
    error.value = null
    isLoading.value = false
  }

  function clearError() {
    error.value = null
  }

  return {
    messages,
    isLoading,
    error,
    addUserMessage,
    handleAIResponse,
    handleError,
    setLoading,
    clearChat,
    clearError,
  }
})
