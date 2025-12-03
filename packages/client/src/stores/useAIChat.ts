import type { CoreRetrievalMessages } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToolCall {
  name: string
  description: string
  input?: any
  output?: any
  timestamp: number
  duration?: number // Execution time in milliseconds
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface RAGDebugInfo {
  needsRAG: boolean
  searchQuery: string
  fromUserId?: string
  timeRange?: { start?: number, end?: number }
  isSimpleGreeting?: boolean
  deepSearch?: {
    initialResults: number
    contextRetrievals: number
    totalMessages: number
  }
  toolCalls?: ToolCall[]
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  retrievedMessages?: CoreRetrievalMessages[]
  isStreaming?: boolean
  debugInfo?: RAGDebugInfo
}

export const useAIChatStore = defineStore('ai-chat', () => {
  const messages = ref<AIChatMessage[]>([])
  const isLoading = ref(false)
  const isSearching = ref(false)
  const searchStage = ref<string>('')
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

  function updateAssistantMessage(id: string, content: string, retrievedMessages?: CoreRetrievalMessages[], debugInfo?: RAGDebugInfo) {
    const message = messages.value.find(msg => msg.id === id)
    if (message) {
      message.content = content
      if (retrievedMessages) {
        message.retrievedMessages = retrievedMessages
      }
      if (debugInfo) {
        message.debugInfo = debugInfo
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

  function setSearching(searching: boolean, stage = '') {
    isSearching.value = searching
    searchStage.value = stage
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
    searchStage,
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
