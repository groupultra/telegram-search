import type { ClientRegisterEventHandlerFn } from './index'

import { useAIChatStore } from '../stores/useAIChat'

export function registerAIChatEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  const store = useAIChatStore()

  registerEventHandler('ai-chat:response', ({ response, retrievedMessages }) => {
    store.handleAIResponse(response, retrievedMessages)
  })

  registerEventHandler('ai-chat:error', ({ error }) => {
    store.handleError(error)
  })
}
