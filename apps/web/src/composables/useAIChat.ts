import type { CoreRetrievalMessages } from '@tg-search/core/types'

import * as v from 'valibot'
import { generateObject, streamText } from 'xsai'

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
  isSimpleGreeting?: boolean
}

interface DeepSearchDecision {
  needsContext: boolean
  messageIndex?: number
  reason?: string
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
   * Check if message is a simple greeting that doesn't need RAG
   */
  function isSimpleGreeting(message: string): boolean {
    const greetings = [
      // Chinese greetings
      '你好',
      '您好',
      '嗨',
      '哈喽',
      '早',
      '早上好',
      '下午好',
      '晚上好',
      '晚安',
      '再见',
      '拜拜',
      // English greetings
      'hi',
      'hello',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
      'good night',
      'goodbye',
      'bye',
    ]

    const normalized = message.toLowerCase().trim()
    return greetings.some(greeting => normalized === greeting || normalized === `${greeting}!` || normalized === `${greeting}?`)
  }

  /**
   * Use LLM to determine if RAG is needed and extract filters
   * Uses xsai's generateObject with valibot schema for structured output
   */
  async function determineRAGNeeds(message: string, llmConfig: LLMConfig): Promise<RAGDecision> {
    // Skip RAG for simple greetings
    if (isSimpleGreeting(message)) {
      return {
        needsRAG: false,
        searchQuery: '',
        isSimpleGreeting: true,
      }
    }

    const currentTime = Math.floor(Date.now() / 1000)

    // Define schema using valibot (Standard Schema compatible)
    const schema = v.object({
      needsRAG: v.boolean('Whether the query needs context from Telegram message history'),
      searchQuery: v.string('Key search terms/query to retrieve relevant messages'),
      fromUserId: v.optional(v.nullable(v.string('User ID filter if a specific person is mentioned'))),
      timeRange: v.optional(v.nullable(v.object({
        start: v.optional(v.nullable(v.number('Unix timestamp in seconds for the start of the time range'))),
        end: v.optional(v.nullable(v.number('Unix timestamp in seconds for the end of the time range'))),
      }, 'Time range filter for messages'))),
    })

    const systemPrompt = `You are a query analyzer. Determine if the user's question needs context from their Telegram message history to answer.

Current time: ${currentTime} (Unix timestamp in seconds)

Examples:
- "What did John say about the meeting?" -> needsRAG: true, searchQuery: "John meeting", fromUserId: null, timeRange: null
- "What's the capital of France?" -> needsRAG: false, searchQuery: "", fromUserId: null, timeRange: null
- "Show messages from Alice last week" -> needsRAG: true, searchQuery: "Alice", fromUserId: null, timeRange: {start: ${currentTime - 7 * 86400}, end: ${currentTime}}
- "What did we discuss yesterday?" -> needsRAG: true, searchQuery: "discuss", fromUserId: null, timeRange: {start: ${currentTime - 86400}, end: ${currentTime}}
- "Tell me a joke" -> needsRAG: false, searchQuery: "", fromUserId: null, timeRange: null
- "我喜欢吃什么" -> needsRAG: true, searchQuery: "喜欢 吃", fromUserId: null, timeRange: null`

    try {
      const result = await generateObject({
        baseURL: llmConfig.apiBase,
        model: llmConfig.model,
        apiKey: llmConfig.apiKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        schema,
        schemaName: 'RAGDecision',
        schemaDescription: 'Analysis of whether RAG is needed and what filters to apply',
        temperature: 0.1,
        output: 'object',
      })

      // Convert null to undefined to match interface expectations
      const timeRange = result.object.timeRange
      const processedTimeRange = timeRange
        ? {
            start: timeRange.start ?? undefined,
            end: timeRange.end ?? undefined,
          }
        : undefined

      return {
        needsRAG: result.object.needsRAG || false,
        searchQuery: result.object.searchQuery || '',
        fromUserId: result.object.fromUserId ?? undefined,
        timeRange: processedTimeRange,
      }
    }
    catch {
      // On error, default to using RAG
      return { needsRAG: true, searchQuery: message }
    }
  }

  /**
   * Deep search: Determine if we need context around a specific retrieved message
   */
  async function determineDeepSearchNeeds(
    userQuery: string,
    retrievedMessages: CoreRetrievalMessages[],
    llmConfig: LLMConfig,
  ): Promise<DeepSearchDecision> {
    if (retrievedMessages.length === 0) {
      return { needsContext: false }
    }

    const schema = v.object({
      needsContext: v.boolean('Whether we need surrounding context of any retrieved message'),
      messageIndex: v.optional(v.nullable(v.number('Index of the message that needs context (0-based)'))),
      reason: v.optional(v.nullable(v.string('Reason why context is needed'))),
    })

    const messagesPreview = retrievedMessages.slice(0, 5).map((msg, idx) => {
      const date = new Date(msg.platformTimestamp * 1000).toLocaleString()
      const content = (msg.content || '[Media]').substring(0, 100)
      return `[${idx}] ${date}: ${content}`
    }).join('\n')

    const systemPrompt = `You are analyzing search results to determine if we need more context.

User Query: "${userQuery}"

Retrieved Messages:
${messagesPreview}

Determine if any message would benefit from having its surrounding context (5 messages before it) to better answer the user's query.
For example, if a message says "我想吃这个" (I want to eat this), we'd need the context to know what "this" refers to.

If context is needed, specify which message index (0-based) and why.`

    try {
      const result = await generateObject({
        baseURL: llmConfig.apiBase,
        model: llmConfig.model,
        apiKey: llmConfig.apiKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze if context is needed' },
        ],
        schema,
        schemaName: 'DeepSearchDecision',
        schemaDescription: 'Decision on whether surrounding context is needed',
        temperature: 0.1,
        output: 'object',
      })

      return {
        needsContext: result.object.needsContext || false,
        messageIndex: result.object.messageIndex ?? undefined,
        reason: result.object.reason ?? undefined,
      }
    }
    catch {
      return { needsContext: false }
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
    determineDeepSearchNeeds,
    buildContextFromRetrievedMessages,
    buildSystemPrompt,
    callLLMWithStreaming,
  }
}
