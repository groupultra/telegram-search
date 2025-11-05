import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { generateText, streamText } from 'xsai'

interface LLMConfig {
  provider: string
  model: string
  apiKey: string
  apiBase: string
  temperature?: number
  maxTokens?: number
}

interface RAGDecision {
  needsRAG: boolean
  searchQuery: string
  fromUserId?: string
  timeRange?: { start?: number, end?: number }
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Composable for AI chat functionality
 * Extracts business logic from the view component
 */
export function useAIChatLogic() {
  /**
   * Use LLM to determine if RAG is needed and extract filters
   */
  async function determineRAGNeeds(message: string, llmConfig: LLMConfig): Promise<RAGDecision> {
    const systemPrompt = `You are a query analyzer. Determine if the user's question needs context from their Telegram message history to answer.
If it needs context, extract:
1. Key search terms/query
2. User/person filter (if mentioned by name or identifier)
3. Time range (if mentioned - convert to Unix timestamp in seconds, current time is ${Math.floor(Date.now() / 1000)})

Respond in JSON format: {
  "needsRAG": boolean,
  "searchQuery": "extracted query or empty string",
  "fromUserId": "user ID if mentioned, otherwise null",
  "timeRange": {"start": timestamp or null, "end": timestamp or null}
}

Examples:
- "What did John say about the meeting?" -> {"needsRAG": true, "searchQuery": "John meeting", "fromUserId": null, "timeRange": null}
- "What's the capital of France?" -> {"needsRAG": false, "searchQuery": "", "fromUserId": null, "timeRange": null}
- "Show messages from Alice last week" -> {"needsRAG": true, "searchQuery": "Alice", "fromUserId": null, "timeRange": {"start": ${Math.floor(Date.now() / 1000) - 7 * 86400}, "end": ${Math.floor(Date.now() / 1000)}}}
- "What did we discuss yesterday?" -> {"needsRAG": true, "searchQuery": "discuss", "fromUserId": null, "timeRange": {"start": ${Math.floor(Date.now() / 1000) - 86400}, "end": ${Math.floor(Date.now() / 1000)}}}
- "Tell me a joke" -> {"needsRAG": false, "searchQuery": "", "fromUserId": null, "timeRange": null}`

    try {
      const result = await generateText({
        baseURL: llmConfig.apiBase,
        model: llmConfig.model,
        apiKey: llmConfig.apiKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.1,
      })

      const content = result.text || '{}'

      // Try to parse JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            needsRAG: parsed.needsRAG || false,
            searchQuery: parsed.searchQuery || '',
            fromUserId: parsed.fromUserId || undefined,
            timeRange: parsed.timeRange || undefined,
          }
        }
      }
      catch {
        // If parsing fails, default to using RAG
        return { needsRAG: true, searchQuery: message }
      }

      return { needsRAG: true, searchQuery: message }
    }
    catch {
      // On error, default to using RAG
      return { needsRAG: true, searchQuery: message }
    }
  }

  /**
   * Build context message from retrieved messages
   */
  function buildContextFromRetrievedMessages(retrievedMessages: CoreRetrievalMessages[]): string {
    return retrievedMessages.map((msg) => {
      const date = new Date(msg.platformTimestamp * 1000).toLocaleString()
      // Sanitize message content to remove control characters
      // eslint-disable-next-line no-control-regex
      const sanitizedContent = (msg.content || '[Media]').replace(/[\x00-\x1F\x7F]/g, '')
      return `[${date}] ${sanitizedContent}`
    }).join('\n\n')
  }

  /**
   * Build system prompt with or without context
   */
  function buildSystemPrompt(contextMessages: string): string {
    if (contextMessages) {
      return `You are a helpful AI assistant that helps users understand their Telegram message history. 

Below is relevant context retrieved from the user's messages:

${contextMessages}

Use this context to provide helpful, accurate responses.`
    }
    return 'You are a helpful AI assistant. Answer the user\'s question directly and concisely.'
  }

  /**
   * Call LLM API with streaming support using xsai
   */
  async function callLLMWithStreaming(
    llmConfig: LLMConfig,
    messages: Message[],
    onTextDelta: (delta: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 60000) // 60s timeout

    try {
      await streamText({
        baseURL: llmConfig.apiBase,
        model: llmConfig.model,
        apiKey: llmConfig.apiKey,
        messages,
        temperature: llmConfig.temperature ?? 0.7,
        abortSignal: abortController.signal,
        onEvent: (event) => {
          if (event.type === 'text-delta') {
            onTextDelta(event.text)
          }
        },
      })

      clearTimeout(timeoutId)
      onComplete()
    }
    catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        onError(new Error('LLM API request timed out'))
      }
      else {
        onError(error instanceof Error ? error : new Error('Unknown error'))
      }
    }
  }

  return {
    determineRAGNeeds,
    buildContextFromRetrievedMessages,
    buildSystemPrompt,
    callLLMWithStreaming,
  }
}
