import type { CoreRetrievalMessages } from '@tg-search/core/types'
import type { InferInput } from 'valibot'

import { useLogger } from '@guiiai/logg'
import { tool } from '@xsai/tool'
import { generateText } from 'xsai'

import * as v from 'valibot'

const logger = useLogger('composables:ai-chat')

interface LLMConfig {
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

export interface ToolCallRecord {
  name: string
  description: string
  input?: any
  output?: any
  timestamp: number
  duration?: number
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

interface SearchMessagesParams {
  query: string
  useVector: boolean
  limit: number
  fromUserId?: string | null
  timeRange?: { start?: number | null, end?: number | null } | null
  chatIds?: string[] | null
}

interface RetrieveContextParams {
  chatId: string
  targetTimestamp: number
  limit: number
}

/**
 * Composable for AI chat functionality with real tool calling
 */
export function useAIChatLogic() {
  /**
   * Create search messages tool
   */
  async function createSearchMessagesTool(
    executor: (params: SearchMessagesParams) => Promise<CoreRetrievalMessages[]>,
  ) {
    logger.log('Creating searchMessages tool')

    const searchMessagesSchema = v.strictObject({
      query: v.pipe(
        v.string(),
        v.description('Search query - keywords or phrases to find in messages'),
      ),
      useVector: v.pipe(
        v.boolean(),
        v.description('Whether to use vector similarity search (true) or text search (false)'),
      ),
      limit: v.pipe(
        v.number(),
        v.description('Maximum number of messages to retrieve (recommended: 5-10)'),
      ),
      chatIds: v.optional(v.pipe(
        v.array(v.string()),
        v.description('List of chat IDs to restrict search to. If provided, only messages from these chats will be returned.'),
      )),
    })

    return await tool({
      name: 'searchMessages',
      description: `Search through Telegram message history using vector similarity or text search.
Use this when the user asks about past conversations, messages, or specific topics discussed.
Parameters:
- query: Search keywords (use Chinese for Chinese queries)
- useVector: true for semantic search (recommended), false for exact text matching
- limit: Number of results (5-10 recommended)`,
      parameters: searchMessagesSchema,
      execute: async (params: InferInput<typeof searchMessagesSchema>) => {
        const startTime = Date.now()
        logger.withFields({ params }).log('searchMessages tool called')

        const results = await executor({
          ...params,
          fromUserId: undefined,
          timeRange: undefined,
          chatIds: params.chatIds || undefined,
        })
        const duration = Date.now() - startTime

        logger.withFields({
          duration,
          resultsCount: results.length,
        }).log('searchMessages completed')

        return JSON.stringify({
          success: true,
          resultsCount: results.length,
          messages: results.map(msg => ({
            chatId: msg.chatId,
            chatName: msg.chatName,
            platformMessageId: msg.platformMessageId,
            fromName: msg.fromName,
            content: msg.content?.substring(0, 200), // Truncate for token efficiency
            platformTimestamp: msg.platformTimestamp,
            similarity: msg.similarity,
          })),
        })
      },
    })
  }

  /**
   * Create retrieve context tool
   */
  async function createRetrieveContextTool(
    executor: (params: RetrieveContextParams) => Promise<CoreRetrievalMessages[]>,
  ) {
    logger.log('Creating retrieveContext tool')

    const retrieveContextSchema = v.strictObject({
      chatId: v.pipe(
        v.string(),
        v.description('Chat ID where the target message is located'),
      ),
      targetTimestamp: v.pipe(
        v.number(),
        v.description('Unix timestamp (seconds) of the target message'),
      ),
      limit: v.pipe(
        v.number(),
        v.description('Number of messages to retrieve before the target (recommended: 3-5)'),
      ),
    })

    return await tool({
      name: 'retrieveContext',
      description: 'Retrieve surrounding messages before a specific message for context. Use this when a search result needs more context to understand (e.g., "this", "that" references).',
      parameters: retrieveContextSchema,
      execute: async (params: InferInput<typeof retrieveContextSchema>) => {
        const startTime = Date.now()
        logger.withFields({ params }).log('retrieveContext tool called')

        const results = await executor(params)
        const duration = Date.now() - startTime

        logger.withFields({
          duration,
          contextCount: results.length,
        }).log('retrieveContext completed')

        return JSON.stringify({
          success: true,
          contextCount: results.length,
          messages: results.map(msg => ({
            platformMessageId: msg.platformMessageId,
            fromName: msg.fromName,
            content: msg.content?.substring(0, 200),
            platformTimestamp: msg.platformTimestamp,
          })),
        })
      },
    })
  }

  /**
   * Call LLM with tool calling support
   */
  async function callLLMWithTools(
    llmConfig: LLMConfig,
    messages: Message[],
    tools: any[],
    onToolCall: (toolCall: ToolCallRecord) => void,
    onToolResult: (toolName: string, result: string, duration: number) => void,
    onTextDelta: (delta: string) => void,
    onComplete: (totalUsage: { promptTokens: number, completionTokens: number, totalTokens: number }) => void,
  ): Promise<void> {
    logger.log('Starting LLM call with tools')
    logger.withFields({
      messagesCount: messages.length,
      toolsCount: tools.length,
      availableTools: tools.map(t => t.function.name),
    }).log('LLM configuration')

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      logger.error('Request timed out after 60s')
      abortController.abort()
    }, 60000)

    // Track tool call start times
    const toolCallStartTimes = new Map<string, number>()

    const result = await generateText({
      baseURL: llmConfig.apiBase,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      messages,
      tools,
      temperature: llmConfig.temperature ?? 0.7,
      maxSteps: 5, // Allow up to 5 tool calling steps
      abortSignal: abortController.signal,
      onEvent: (event: any) => {
        // Log all events for debugging
        if (event.type === 'tool-call') {
          const startTime = Date.now()
          toolCallStartTimes.set(event.toolCall.id, startTime)

          logger.withFields({
            toolName: event.toolCall.name,
            arguments: event.toolCall.arguments,
          }).log('Tool call initiated')

          onToolCall({
            name: event.toolCall.name,
            description: tools.find(t => t.function.name === event.toolCall.name)?.function.description || '',
            input: event.toolCall.arguments,
            output: null,
            timestamp: startTime,
          })
        }
        else if (event.type === 'tool-result') {
          const startTime = toolCallStartTimes.get(event.toolResult.id) || Date.now()
          const duration = Date.now() - startTime

          logger.withFields({
            toolName: event.toolResult.name,
            duration,
            resultPreview: event.toolResult.result?.substring(0, 200),
          }).log('Tool result received')

          onToolResult(event.toolResult.name, event.toolResult.result, duration)
        }
        else if (event.type === 'text-delta') {
          onTextDelta(event.text)
        }
        else if (event.type === 'step-start') {
          logger.withFields({ step: event.step }).log('Step started')
        }
        else if (event.type === 'step-finish') {
          if (event.usage) {
            logger.withFields({
              step: event.step,
              promptTokens: event.usage.prompt_tokens,
              completionTokens: event.usage.completion_tokens,
              totalTokens: event.usage.total_tokens,
            }).log('Step finished')
          }
          else {
            logger.withFields({ step: event.step }).log('Step finished')
          }
        }
      },
    })

    clearTimeout(timeoutId)

    logger.withFields({
      textLength: result.text?.length ?? 0,
      stepsCount: result.steps.length,
    }).log('Generation completed')

    // If there's final text and no text-delta events were fired, send the complete text
    if (result.text) {
      onTextDelta(result.text)
    }

    if (result.usage) {
      logger.withFields({
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      }).log('Total usage')

      onComplete({
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
        totalTokens: result.usage.total_tokens || 0,
      })
    }
    else {
      logger.warn('No usage data available')
      onComplete({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      })
    }
  }

  /**
   * Build system prompt
   */
  function buildSystemPrompt(): string {
    return `You are a helpful AI assistant with access to the user's Telegram message history.

IMPORTANT INSTRUCTIONS:
1. When the user asks about past messages, conversations, or specific topics, you MUST use the searchMessages tool
2. Simple greetings and general knowledge questions do NOT require searching - respond directly
3. When using searchMessages:
   - For Chinese queries, use Chinese keywords in the query
   - Set useVector=true for semantic search (recommended for most cases)
   - Set useVector=false for exact text matching
   - Set limit to 5-10 for most queries
4. If a search result contains ambiguous references (like "this", "that", "it"), use retrieveContext to get surrounding messages
5. Always cite specific messages when answering (mention date, sender, chat name if available)
6. Be concise and direct in your responses

EXAMPLES:
- "Hello" -> Respond directly with a greeting, NO tool calling
- "How are you?" -> Respond directly, NO tool calling
- "What did we discuss?" -> Use searchMessages with query="discuss", useVector=true, limit=5
- "What do I like to eat" -> Use searchMessages with query="like eat", useVector=true, limit=5

Remember: Only use tools when necessary. For greetings or general questions, respond directly without calling any tools.`
  }

  return {
    createSearchMessagesTool,
    createRetrieveContextTool,
    callLLMWithTools,
    buildSystemPrompt,
  }
}
