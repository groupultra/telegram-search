import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'

import { createChatPicker } from './chat-picker'
import { buildTelegramMessageLinks, getAccountChats, getChatTypeIcon, sanitizeText } from './helpers'

const DEFAULT_EMBEDDING_DIMENSION = 1536

interface UserSearchState {
  mode: 'selecting' | 'text_search_chat' | 'searching'
  chatId?: string
  query?: string
  resultPage?: number
}

const userStates = new Map<number, UserSearchState>()

export function registerSearchCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:search')

  const picker = createChatPicker(bot, ctx, {
    prefix: 'S',
    folderHeader: '🔍 Select where to search:',
    chatListHeader: '🔍 Select a chat to search in:',
    allOptionLabel: '🌐 Search All Chats',
    onSearchByName: async (gramCtx, userId) => {
      userStates.set(userId, { mode: 'text_search_chat' })
      await gramCtx.editMessageText('🔍 Type the chat name to search:\n\n(Partial match supported)')
    },
    onSelected: async (gramCtx, userId, chatId, chatName) => {
      userStates.set(userId, { mode: 'searching', chatId })
      await gramCtx.editMessageText(`✅ Selected: ${chatName}\n\n💬 Now send me your search query:`)
    },
    onReset: (userId) => {
      userStates.set(userId, { mode: 'selecting' })
    },
  })

  // /search command - kick off the picker flow
  bot.command('search', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      await gramCtx.reply('Could not identify you.')
      return
    }

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.reply('Your account is not linked. Please log in through the web interface first.')
      return
    }

    try {
      userStates.set(userId, { mode: 'selecting' })
      await picker.showFolders(gramCtx, userId)
    }
    catch (error) {
      logger.withError(error).error('Search command failed')
      await gramCtx.reply('An error occurred. Please try again later.')
    }
  })

  // Continue searching in same chat
  bot.callbackQuery(/^action:continue_search$/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const state = userStates.get(userId)
    if (!state || !state.chatId) {
      await gramCtx.answerCallbackQuery('Session expired. Please /search again.')
      return
    }

    state.mode = 'searching'
    await gramCtx.answerCallbackQuery()
    await gramCtx.reply('💬 Send me a new search query:')
  })

  // End search session
  bot.callbackQuery(/^action:end_search$/, async (gramCtx) => {
    const userId = gramCtx.from.id
    userStates.delete(userId)
    picker.clearState(userId)

    await gramCtx.answerCallbackQuery('Search ended.')
    await gramCtx.reply('Search session ended. Type /search to start a new search.')
  })

  // Result page navigation
  bot.callbackQuery(/^resultpage:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const page = Number.parseInt(gramCtx.callbackQuery.data.replace('resultpage:', ''), 10)

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const state = userStates.get(userId)
      if (!state || !state.chatId || !state.query) {
        await gramCtx.answerCallbackQuery('Session expired. Please /search again.')
        return
      }

      const searchResult = await executeSearchWithPagination(ctx, account.id, state.query, state.chatId, page)
      state.resultPage = page

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(searchResult.text, {
        reply_markup: buildResultKeyboard(searchResult, page, picker.backCallbackData),
      })
    }
    catch (error) {
      logger.withError(error).error('Result page navigation failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle text input (chat name search + search queries)
  bot.on('message:text', async (gramCtx, next) => {
    const userId = gramCtx.from?.id
    if (!userId)
      return next()

    const text = gramCtx.message.text

    // Let command handlers process commands
    if (text.startsWith('/'))
      return next()

    const state = userStates.get(userId)
    if (!state)
      return next()

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.reply('Your account is not linked.')
      return
    }

    try {
      // Text search for chat names
      if (state.mode === 'text_search_chat') {
        const db = ctx.getDB()
        const chats = await getAccountChats(db, account.id)
        const query = text.toLowerCase()

        const matches = chats
          .filter(chat => chat.name.toLowerCase().includes(query))
          .slice(0, 10)

        if (matches.length === 0) {
          await gramCtx.reply('No chats found matching your query. Try again or type /search to start over.')
          return
        }

        // Feed results back into the picker's chat selection flow
        const keyboard = new InlineKeyboard()
        for (const chat of matches) {
          const icon = getChatTypeIcon(chat.type)
          const displayName = sanitizeText(chat.name).slice(0, 40)
          if (displayName) {
            keyboard.text(`${icon} ${displayName}`, picker.chatCallbackData(chat.id)).row()
          }
        }
        keyboard.text('🔙 Back to Folders', picker.backCallbackData).row()

        await gramCtx.reply(`Found ${matches.length} matching chat(s):`, { reply_markup: keyboard })
        return
      }

      // Execute search query
      if (state.mode === 'searching' && state.chatId) {
        await gramCtx.reply('🔍 Searching...')

        const searchResult = await executeSearchWithPagination(ctx, account.id, text, state.chatId, 0)
        state.query = text
        state.resultPage = 0

        // Persist last search chat ID
        const db = ctx.getDB()
        const accountResult = await ctx.models.accountModels.findAccountByUUID(db, account.id)
        const accountData = accountResult.expect('Account not found')
        await ctx.models.accountSettingsModels.updateAccountSettings(db, account.id, {
          ...accountData.settings,
          bot: {
            enabled: accountData.settings?.bot?.enabled ?? false,
            ...accountData.settings?.bot,
            lastSearchChatId: state.chatId,
          },
        })

        await gramCtx.reply(searchResult.text, {
          reply_markup: buildResultKeyboard(searchResult, 0, picker.backCallbackData),
        })
      }
    }
    catch (error) {
      logger.withError(error).error('Search execution failed')
      await gramCtx.reply('An error occurred while searching. Please try again later.')
    }
  })
}

/**
 * Build result keyboard with context buttons, pagination, and actions.
 * Shared between initial search and result page navigation.
 */
function buildResultKeyboard(searchResult: SearchResult, page: number, backCallbackData: string): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  // Context buttons for first 5 results
  const contextMsgs = searchResult.messages.slice(0, 5)
  for (let i = 0; i < contextMsgs.length; i += 3) {
    const row = contextMsgs.slice(i, i + 3)
    for (const [idx, msg] of row.entries()) {
      keyboard.text(`#${i + idx + 1} 📖`, `ctx:${msg.chatId}:${msg.messageId}`)
    }
    keyboard.row()
  }

  // Pagination
  const navButtons: Array<{ text: string, callback_data: string }> = []
  if (page > 0)
    navButtons.push({ text: '⬅️ Prev Page', callback_data: `resultpage:${page - 1}` })
  if (searchResult.hasMore)
    navButtons.push({ text: '➡️ Next Page', callback_data: `resultpage:${page + 1}` })
  if (navButtons.length > 0)
    keyboard.row(...navButtons)

  keyboard.text('🔄 Switch Chat', backCallbackData)
  keyboard.text('🔍 New Query', 'action:continue_search').row()
  keyboard.text('❌ End Search', 'action:end_search').row()

  return keyboard
}

interface SearchResultMessage {
  chatId: string
  messageId: string
}

interface SearchResult {
  text: string
  hasMore: boolean
  messages: SearchResultMessage[]
}

/**
 * Execute search with pagination support.
 * Vector search doesn't support offset, so we fetch (page+1)*limit and slice.
 */
async function executeSearchWithPagination(
  ctx: BotCommandContext,
  accountId: string,
  query: string,
  chatId: string,
  page: number = 0,
): Promise<SearchResult> {
  const logger = ctx.logger.withContext('bot:search:execute')
  const db = ctx.getDB()

  const limit = 10
  const startIdx = page * limit
  const endIdx = startIdx + limit
  const fetchLimit = endIdx + 1

  const filters = chatId === '__ALL__'
    ? {}
    : { chatIds: [chatId] }

  const result = await ctx.models.chatMessageModels.retrieveMessages(
    db,
    logger,
    accountId,
    DEFAULT_EMBEDDING_DIMENSION,
    { text: query },
    { limit: fetchLimit, offset: 0 },
    filters,
  )

  const allMessages = result.expect('Failed to search messages')
  const hasMore = allMessages.length > endIdx
  const messages = allMessages.slice(startIdx, endIdx)

  if (messages.length === 0) {
    return {
      text: page === 0
        ? `No results found for "${query}" in selected chat.`
        : `No more results for "${query}".`,
      hasMore: false,
      messages: [],
    }
  }

  const lines = messages.map((msg, index) => {
    const from = msg.from_name || msg.from_id || 'Unknown'
    const chat = msg.chat_name || msg.in_chat_id || 'Unknown chat'
    const content = (msg.content ?? '').slice(0, 200)
    const time = msg.platform_timestamp
      ? new Date(msg.platform_timestamp * 1000).toLocaleString()
      : 'Unknown time'
    const links = buildTelegramMessageLinks({
      chatId: msg.in_chat_id,
      messageId: msg.platform_message_id,
      chatType: msg.in_chat_type,
    })
    const linkLine = links.length ? `\n🔗 ${links.join(' | ')}` : ''
    return `${startIdx + index + 1}. [${chat}] ${from} (${time}):\n${content}${linkLine}`
  })

  const pageInfo = page > 0 ? ` (Page ${page + 1})` : ''
  return {
    text: `Found results for "${query}"${pageInfo}:\n\n${lines.join('\n\n')}`,
    hasMore,
    messages: messages.map(msg => ({
      chatId: msg.in_chat_id,
      messageId: msg.platform_message_id,
    })),
  }
}

/**
 * Execute search and return formatted text (for inline mode)
 */
export async function executeSearch(
  ctx: BotCommandContext,
  accountId: string,
  query: string,
  chatId: string,
  page: number = 0,
) {
  const result = await executeSearchWithPagination(ctx, accountId, query, chatId, page)
  return result.text
}
