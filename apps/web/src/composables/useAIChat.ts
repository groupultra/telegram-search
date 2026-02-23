import type { CoreDialog, CoreRetrievalMessages, CoreRetrievalPhoto, LLMConfig } from '@tg-search/core/types'
import type { InferInput, InferOutput } from 'valibot'
import type { GenerateTextResult, Message, Tool, ToolCall } from 'xsai'

import { useLogger } from '@guiiai/logg'
import { tool } from '@xsai/tool'
import { generateText, streamText } from 'xsai'

import * as v from 'valibot'

const logger = useLogger('composables:ai-chat')

const DEFAULT_TOOL_SEARCH_LIMIT = 10
const DEFAULT_TOOL_USE_VECTOR = true

export interface SearchMessagesParams {
  query: string
  useVector: boolean
  limit: number
  fromUserId?: string
  timeRange?: { start?: number, end?: number }
  chatIds?: string[] | null
}

export interface RetrieveContextParams {
  chatId: string
  targetTimestamp: number
  limit: number
}

export interface GetDialogsParams {}

export interface SearchPhotosParams {
  query: string
  useVector: boolean
  limit: number
  chatIds?: string[] | null
}

export interface ChatNoteParams {
  chatId: string
  note: string
  modify: boolean
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
        v.optional(v.boolean(), DEFAULT_TOOL_USE_VECTOR),
        v.description('Whether to use vector similarity search (true) or text search (false)'),
      ),
      limit: v.pipe(
        v.optional(v.number(), DEFAULT_TOOL_SEARCH_LIMIT),
        v.description('Maximum number of messages to retrieve (recommended: 5-10)'),
      ),
      chatIds: v.optional(v.pipe(
        v.array(v.string()),
        v.description('List of chat IDs to restrict search to. If provided, only messages from these chats will be returned.'),
      )),
    })

    return await tool({
      name: 'searchMessages',
      description: `Search through Telegram message history (text content/captions only) using vector similarity or text search.
Use this when the user asks about past conversations, messages, or specific topics discussed.
Parameters:
- query: Search keywords (use Chinese for Chinese queries)
- useVector: true for semantic search (recommended), false for exact text matching
- limit: Number of results (5-10 recommended)`,
      parameters: searchMessagesSchema,
      execute: async (params: InferInput<typeof searchMessagesSchema>) => {
        const normalizedParams: InferOutput<typeof searchMessagesSchema> = v.parse(searchMessagesSchema, params)
        const startTime = Date.now()
        logger.withFields({ params: normalizedParams }).log('searchMessages tool called')

        const results = await executor({
          ...normalizedParams,
          fromUserId: undefined,
          timeRange: undefined,
          chatIds: normalizedParams.chatIds || undefined,
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
   * Create get chats tool
   */
  async function createGetDialogsTool(
    executor: (params: GetDialogsParams) => Promise<CoreDialog[]>,
  ) {
    logger.log('Creating getDialogs tool')
    const getDialogsSchema = v.strictObject({})
    return await tool({
      name: 'getDialogs',
      description: `Get a list of chats the user has access to. Use this when the user asks about their chats, conversations list, or what chats they have.`,
      parameters: getDialogsSchema,
      execute: async (params: InferInput<typeof getDialogsSchema>) => {
        const startTime = Date.now()
        logger.withFields({ params }).log('getDialogs tool called')
        const results = await executor(params)
        const duration = Date.now() - startTime
        logger.withFields({
          duration,
          dialogsCount: results.length,
        }).log('getDialogs completed')
        return JSON.stringify({
          success: true,
          dialogsCount: results.length,
          dialogs: results,
        })
      },
    })
  }

  /**
   * Create search photos tool
   */
  async function createSearchPhotosTool(
    executor: (params: SearchPhotosParams) => Promise<CoreRetrievalPhoto[]>,
  ) {
    logger.log('Creating searchPhotos tool')

    const searchPhotosSchema = v.strictObject({
      query: v.pipe(
        v.string(),
        v.description('Search query - keywords or phrases to describe the photo content'),
      ),
      useVector: v.pipe(
        v.optional(v.boolean(), DEFAULT_TOOL_USE_VECTOR),
        v.description('Whether to use vector similarity search (true) or text search (false)'),
      ),
      limit: v.pipe(
        v.optional(v.number(), DEFAULT_TOOL_SEARCH_LIMIT),
        v.description('Maximum number of photos to retrieve (recommended: 5-10)'),
      ),
      chatIds: v.optional(v.pipe(
        v.array(v.string()),
        v.description('List of chat IDs to restrict search to. If provided, only photos from these chats will be returned.'),
      )),
    })

    return await tool({
      name: 'searchPhotos',
      description: `Search through photos in Telegram messages using their AI-generated descriptions.
Use this when the user asks about images, photos, or visual content from past conversations.
Parameters:
- query: Describe what to look for in photos (e.g., "sunset", "people eating", "text screenshot")
- useVector: true for semantic search (recommended), false for exact text matching
- limit: Number of results (5-10 recommended)`,
      parameters: searchPhotosSchema,
      execute: async (params: InferInput<typeof searchPhotosSchema>) => {
        const normalizedParams: InferOutput<typeof searchPhotosSchema> = v.parse(searchPhotosSchema, params)
        const startTime = Date.now()
        logger.withFields({ params: normalizedParams }).log('searchPhotos tool called')

        const results = await executor({
          ...normalizedParams,
          chatIds: normalizedParams.chatIds || undefined,
        })
        const duration = Date.now() - startTime

        logger.withFields({
          duration,
          resultsCount: results.length,
        }).log('searchPhotos completed')

        return JSON.stringify({
          success: true,
          resultsCount: results.length,
          photos: results.map(photo => ({
            id: photo.id,
            chatId: photo.chatId,
            chatName: photo.chatName,
            description: photo.description?.substring(0, 200), // Truncate for token efficiency
            createdAt: photo.createdAt,
            similarity: photo.similarity,
          })),
        })
      },
    })
  }

  async function createChatNoteTool(
    executor: (params: ChatNoteParams) => Promise<string>,
  ) {
    logger.log('Creating chatNote tool')
    const chatNoteSchema = v.strictObject({
      chatId: v.pipe(
        v.string(),
        v.description('Chat ID to add or modify a note for'),
      ),
      note: v.pipe(
        v.string(),
        v.description('Note to add or modify for the chat'),
      ),
      modify: v.pipe(
        v.boolean(),
        v.description('Whether to modify the note or add a new one, if you need to get the note, set modify to false'),
      ),
    })
    return await tool({
      name: 'chatNote',
      description: 'Add or modify a note for a chat. Use this when the user asks to add or modify a note for a chat. If you need to get the note, set modify to false',
      parameters: chatNoteSchema,
      execute: async (params: InferInput<typeof chatNoteSchema>) => {
        const startTime = Date.now()
        logger.withFields({ params }).log('chatNote tool called')
        const result = await executor(params)
        const duration = Date.now() - startTime
        logger.withFields({
          duration,
          result,
        }).log('chatNote completed')
        return JSON.stringify({
          success: true,
          result,
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
    tools: Tool[],
    onToolCall: (toolCall: ToolCall) => void,
    onToolResult: (toolName: string, result: unknown, duration: number) => void,
    onTextDelta: (delta: string) => void,
    onComplete: (totalUsage: { promptTokens: number, completionTokens: number, totalTokens: number }) => void,
  ): Promise<void> {
    logger.log('Starting LLM call with tools')
    logger.withFields({
      messagesCount: messages.length,
      toolsCount: tools.length,
    }).log('LLM configuration')

    let completed = false
    const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

    const emitComplete = (usage: { promptTokens: number, completionTokens: number, totalTokens: number }) => {
      if (completed) {
        return
      }
      completed = true
      onComplete(usage)
    }

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      logger.error('Request timed out after 60s')
      abortController.abort()
      emitComplete({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
    }, 60000)

    try {
      const requestStartedAt = Date.now()
      const result: GenerateTextResult = await generateText({
        baseURL: llmConfig.apiBase,
        model: llmConfig.model,
        apiKey: llmConfig.apiKey,
        messages,
        tools,
        maxSteps: 5,
        temperature: llmConfig.temperature ?? 0.7,
        abortSignal: abortController.signal,
      })
      const requestDuration = Date.now() - requestStartedAt

      logger.withFields({
        finishReason: result.finishReason,
        stepCount: result.steps.length,
      }).log('LLM request finished')

      for (const completionStep of result.steps) {
        for (const toolCall of completionStep.toolCalls) {
          const toolDef = tools.find(item => item.function?.name === toolCall.toolName)
          onToolCall({
            name: toolCall.toolName,
            description: toolDef?.function?.description ?? toolCall.toolName,
            input: toolCall.args,
            timestamp: Date.now(),
          })
        }

        const perToolDuration = completionStep.toolResults.length > 0
          ? Math.max(1, Math.round(requestDuration / completionStep.toolResults.length))
          : requestDuration

        for (const toolResult of completionStep.toolResults) {
          onToolResult(toolResult.toolName, toolResult.result, perToolDuration)
        }
      }

      if (result.usage) {
        const usage = result.usage
        totalUsage.promptTokens += usage.prompt_tokens
        totalUsage.completionTokens += usage.completion_tokens
        totalUsage.totalTokens += usage.total_tokens
      }

      if (result.text) {
        onTextDelta(result.text)
      }

      emitComplete(totalUsage)
    }
    catch (error) {
      logger.withError(error).error('LLM call with tools failed')
      emitComplete({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
      throw error
    }
    finally {
      clearTimeout(timeoutId)
    }
  }

  async function streamSimpleText(
    llmConfig: LLMConfig,
    messages: Message[],
    onTextDelta: (delta: string) => void,
  ): Promise<void> {
    logger.withFields({
      messagesCount: messages.length,
    }).log('Starting simple LLM streaming')

    const { textStream } = streamText({
      baseURL: llmConfig.apiBase,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      messages,
      temperature: llmConfig.temperature ?? 0.7,
      maxTokens: llmConfig.maxTokens,
    })

    const iterable = textStream as unknown as AsyncIterable<string>
    for await (const text of iterable) {
      onTextDelta(text)
    }
  }

  /**
   * Build system prompt
   */
  function buildSystemPrompt(): string {
    return `You are a helpful AI assistant with access to the user's Telegram message history.

IMPORTANT INSTRUCTIONS:
1. When the user asks about past messages, conversations, or specific topics, you MUST use the searchMessages tool
2. When the user asks about photos, images, or visual content, you MUST use the searchPhotos tool
3. Simple greetings and general knowledge questions do NOT require searching - respond directly
4. When using searchMessages:
   - For Chinese queries, use Chinese keywords in the query
   - Set useVector=true for semantic search (recommended for most cases)
   - Set useVector=false for exact text matching
   - Set limit to 5-10 for most queries
5. When using searchPhotos:
   - Describe the visual content you're looking for (e.g., "sunset", "people eating", "screenshot with text")
   - Set useVector=true for semantic search (recommended)
   - Set limit to 5-10 for most queries
6. If the user's query is broad or could refer to either text OR visual content (e.g., "Find that thing about cats"), use BOTH searchMessages AND searchPhotos
7. If a search result contains ambiguous references (like "this", "that", "it"), use retrieveContext to get surrounding messages
8. Always cite specific messages when answering (mention date, sender, chat name if available)
9. Be concise and direct in your responses
10. If the user asks about their chats, conversations list, or what chats they have, use the getDialogs tool
11. If the user asks to add or modify a note for a chat, use the chatNote tool

EXAMPLES:
- "Hello" -> Respond directly with a greeting, NO tool calling
- "How are you?" -> Respond directly, NO tool calling
- "What did we discuss?" -> Use searchMessages with query="discuss", useVector=true, limit=5
- "What do I like to eat" -> Use BOTH searchMessages (query="like eat") AND searchPhotos (query="food eating meal")
- "Who said 'hello'?" -> Use searchMessages with query="hello", useVector=false, limit=5
- "Show me photos of sunset" -> Use searchPhotos with query="sunset", useVector=true, limit=5
- "Find images with food" -> Use searchPhotos with query="food eating meal", useVector=true, limit=5
- “Add a note for this chat” -> Use chatNote with chatId=currentChatId, note="This is a note for this chat", modify=true
- "Get the note for this chat" -> Use chatNote with chatId=currentChatId, note="", modify=false

Remember: Only use tools when necessary. For greetings or general questions, respond directly without calling any tools.`
  }

  return {
    createSearchMessagesTool,
    createRetrieveContextTool,
    createGetDialogsTool,
    createSearchPhotosTool,
    createChatNoteTool,
    callLLMWithTools,
    streamSimpleText,
    buildSystemPrompt,
  }
}
