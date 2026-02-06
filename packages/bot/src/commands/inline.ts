import type { Bot } from 'grammy'
import type { InlineQueryResult } from 'grammy/types'

import type { BotCommandContext } from '.'

import { getAccountChats } from './helpers'

const DEFAULT_EMBEDDING_DIMENSION = 1536

/**
 * Parse inline query to extract query and optional chat filter
 *
 * Supported formats:
 * - "query" - search all chats
 * - "query in:chatname" - search in specific chat (fuzzy match)
 * - "query @chatname" - alternative syntax
 */
function parseInlineQuery(text: string): { query: string, chatFilter?: string } {
  // Match "in:chatname" or "@chatname"
  // Use indexOf to avoid regex backtracking issues
  const inIndex = text.toLowerCase().lastIndexOf(' in:')
  if (inIndex !== -1) {
    const query = text.slice(0, inIndex).trim()
    const chatFilter = text.slice(inIndex + 4).trim()
    if (query && chatFilter) {
      return { query, chatFilter }
    }
  }

  const atIndex = text.lastIndexOf(' @')
  if (atIndex !== -1) {
    const query = text.slice(0, atIndex).trim()
    const chatFilter = text.slice(atIndex + 2).trim()
    if (query && chatFilter) {
      return { query, chatFilter }
    }
  }

  return { query: text.trim() }
}

/**
 * Find chat ID by fuzzy matching name
 */
async function findChatByName(
  ctx: BotCommandContext,
  accountId: string,
  chatName: string,
): Promise<string | undefined> {
  const db = ctx.getDB()
  const chats = await getAccountChats(db, accountId)

  // Exact match (case insensitive)
  const exactMatch = chats.find(c => c.name.toLowerCase() === chatName.toLowerCase())
  if (exactMatch) {
    return exactMatch.id
  }

  // Partial match (contains)
  const partialMatch = chats.find(c => c.name.toLowerCase().includes(chatName.toLowerCase()))
  if (partialMatch) {
    return partialMatch.id
  }

  return undefined
}

/**
 * Register inline query handler
 *
 * Allows users to search from any chat by typing "@botname query"
 */
export function registerInlineQueryHandler(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:inline')

  bot.on('inline_query', async (gramCtx) => {
    const userId = gramCtx.inlineQuery.from.id
    const queryText = gramCtx.inlineQuery.query

    // Empty query - show help
    if (!queryText) {
      await gramCtx.answerInlineQuery([])
      return
    }

    try {
      const account = await ctx.resolveAccountByTelegramUserId(userId)
      if (!account) {
        await gramCtx.answerInlineQuery([])
        return
      }

      // Parse query
      const { query, chatFilter } = parseInlineQuery(queryText)

      if (!query) {
        await gramCtx.answerInlineQuery([])
        return
      }

      // Resolve chat filter to chat ID
      let chatId: string | undefined
      if (chatFilter) {
        chatId = await findChatByName(ctx, account.id, chatFilter)
        if (!chatId) {
          // Chat not found - return empty results
          await gramCtx.answerInlineQuery([])
          return
        }
      }

      // Execute search
      const db = ctx.getDB()
      const result = await ctx.models.chatMessageModels.retrieveMessages(
        db,
        logger,
        account.id,
        DEFAULT_EMBEDDING_DIMENSION,
        { text: query },
        { limit: 10, offset: 0 },
        chatId ? { chatIds: [chatId] } : undefined,
      )

      const messages = result.expect('Failed to search messages')

      // Convert to inline results
      const inlineResults: InlineQueryResult[] = messages.map((msg, index) => {
        const from = msg.from_name || msg.from_id || 'Unknown'
        const chat = msg.chat_name || msg.in_chat_id || 'Unknown chat'
        const content = (msg.content ?? '').slice(0, 200)
        const time = msg.platform_timestamp
          ? new Date(msg.platform_timestamp * 1000).toLocaleString()
          : 'Unknown time'

        const title = `[${chat}] ${from}`
        const description = content.slice(0, 100)

        return {
          type: 'article',
          id: `${msg.id}-${index}`,
          title,
          description,
          input_message_content: {
            message_text: `📨 Message from [${chat}]\n👤 ${from}\n🕒 ${time}\n\n${content}`,
          },
        }
      })

      if (inlineResults.length === 0) {
        // No results - return empty
        await gramCtx.answerInlineQuery([])
        return
      }

      await gramCtx.answerInlineQuery(inlineResults, {
        cache_time: 60, // Cache for 1 minute
      })
    }
    catch (error) {
      logger.withError(error).error('Inline query failed')
      await gramCtx.answerInlineQuery([])
    }
  })
}
