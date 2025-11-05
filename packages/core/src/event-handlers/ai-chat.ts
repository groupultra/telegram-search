import type { CoreContext } from '../context'
import type { CoreRetrievalMessages } from '../types/events'
import type { AIChatEventToCore } from '../types/events'

import { useLogger } from '@guiiai/logg'

export function registerAIChatEventHandlers(ctx: CoreContext) {
  const logger = useLogger()
  const { emitter } = ctx

  emitter.on('ai-chat:send', async ({ message, conversationHistory = [] }: Parameters<AIChatEventToCore['ai-chat:send']>[0]) => {
    try {
      logger.withFields({ message }).log('Handling AI chat message')

      // Get configuration
      const { useConfig } = await import('@tg-search/common')
      const config = useConfig()

      // Validate LLM configuration
      if (!config.api?.llm?.apiKey) {
        emitter.emit('ai-chat:error', { error: 'LLM API key not configured' })
        return
      }

      // Step 1: Perform RAG - retrieve relevant messages using vector search
      logger.log('Retrieving relevant messages for RAG')
      const retrievedMessages: CoreRetrievalMessages[] = await new Promise((resolve) => {
        emitter.once('storage:search:messages:data', ({ messages }: { messages: CoreRetrievalMessages[] }) => {
          resolve(messages)
        })

        emitter.emit('storage:search:messages', {
          content: message,
          useVector: true,
          pagination: {
            limit: 5,
            offset: 0,
          },
        })
      })

      logger.withFields({ retrievedCount: retrievedMessages.length }).log('Retrieved messages for RAG')

      // Step 2: Build context from retrieved messages
      const contextMessages = retrievedMessages.map((msg) => {
        const date = new Date((msg as any).platformTimestamp).toLocaleString()
        return `[${date}] ${(msg as any).content || '[Media]'}`
      }).join('\n\n')

      // Step 3: Build the prompt with conversation history
      const systemPrompt = `You are a helpful AI assistant that helps users understand their Telegram message history. 

Below is relevant context retrieved from the user's messages that may help answer their question:

${contextMessages || 'No relevant messages found.'}

Use this context to provide helpful, accurate responses. If the context doesn't contain relevant information, you can still answer based on your general knowledge, but make it clear when you're doing so.`

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory,
        { role: 'user' as const, content: message },
      ]

      // Step 4: Call LLM API
      logger.log('Calling LLM API')
      const response = await callLLMAPI(config.api.llm, messages)

      // Step 5: Emit response with retrieved messages
      emitter.emit('ai-chat:response', {
        response,
        retrievedMessages,
      })
    }
    catch (error) {
      logger.withError(error).error('Failed to process AI chat message')
      emitter.emit('ai-chat:error', {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  })
}

interface LLMConfig {
  provider: string
  model: string
  apiKey: string
  apiBase: string
  temperature?: number
  maxTokens?: number
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callLLMAPI(config: LLMConfig, messages: Message[]): Promise<string> {
  const logger = useLogger()

  const apiUrl = `${config.apiBase}/chat/completions`

  const requestBody = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 2000,
  }

  logger.withFields({ apiUrl, model: config.model }).log('Sending request to LLM API')

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.withFields({ status: response.status, error: errorText }).error('LLM API request failed')
    throw new Error(`LLM API request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from LLM API')
  }

  return data.choices[0].message.content
}
