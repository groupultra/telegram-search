import type { CoreMessage } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SummarySession {
  content: string
  sourceMessages: CoreMessage[]
  mode: 'unread' | 'today' | 'last24h' | 'none'
  isLoading: boolean
  lastUpdated: number
}

export const useSummarizeStore = defineStore('summarize', () => {
  const sessions = ref<Record<string, SummarySession>>({})

  function getSession(chatId: string) {
    if (!sessions.value[chatId]) {
      sessions.value[chatId] = {
        content: '',
        sourceMessages: [],
        mode: 'none',
        isLoading: false,
        lastUpdated: 0,
      }
    }
    return sessions.value[chatId]
  }

  function setSummary(
    chatId: string,
    content: string,
    messages: CoreMessage[],
    meta?: { mode?: SummarySession['mode'] },
  ) {
    const session = getSession(chatId)
    session.content = content
    session.sourceMessages = messages
    session.mode = meta?.mode ?? session.mode
    session.lastUpdated = Date.now()
  }

  function appendSummary(chatId: string, delta: string) {
    const session = getSession(chatId)
    session.content += delta
  }

  function setSourceMessages(
    chatId: string,
    messages: CoreMessage[],
    meta?: { mode?: SummarySession['mode'] },
  ) {
    const session = getSession(chatId)
    session.sourceMessages = messages
    session.mode = meta?.mode ?? session.mode
  }

  function setLoading(chatId: string, isLoading: boolean) {
    const session = getSession(chatId)
    session.isLoading = isLoading
  }

  function clearSession(chatId: string) {
    delete sessions.value[chatId]
  }

  return {
    sessions,
    getSession,
    setSummary,
    appendSummary,
    setSourceMessages,
    setLoading,
    clearSession,
  }
})
