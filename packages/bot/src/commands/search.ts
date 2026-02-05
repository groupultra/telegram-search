import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'

import { getAccountChats } from './helpers'

const DEFAULT_EMBEDDING_DIMENSION = 1536
const CHATS_PER_PAGE = 8

// User search state management
interface UserSearchState {
  mode: 'idle' | 'selecting_folder' | 'selecting_chat' | 'searching' | 'text_search_chat'
  folderId?: number // Selected folder ID (undefined = all chats)
  chatId?: string // Selected chat ID
  query?: string // Current search query
  chatListPage?: number // Chat list page number
  resultPage?: number // Result page number
}

const userStates = new Map<number, UserSearchState>()

export function registerSearchCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:search')

  // /search command - show folder selection
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
      const db = ctx.getDB()

      // Get folders from database
      const foldersResult = await ctx.models.chatFolderModels.findFoldersByAccountId(db, account.id)
      const folders = foldersResult.expect('Failed to get folders')

      // Initialize user state
      userStates.set(userId, {
        mode: 'selecting_folder',
        chatListPage: 0,
      })

      // Build folder selection keyboard
      const keyboard = new InlineKeyboard()

      // Add "All Chats" option
      keyboard.text('🌐 All Chats', 'folder:all').row()

      // Add folder options
      for (const folder of folders) {
        const icon = folder.emoticon || '📁'
        const name = folder.title
        keyboard.text(`${icon} ${name}`, `folder:${folder.id}`).row()
      }

      // Add "Search Chat" button
      keyboard.text('🔍 Search Chat by Name', 'action:search_chat').row()

      await gramCtx.reply(
        '🔍 Select where to search:',
        { reply_markup: keyboard },
      )
    }
    catch (error) {
      logger.withError(error).error('Search command failed')
      await gramCtx.reply('An error occurred. Please try again later.')
    }
  })

  // Handle folder selection
  bot.callbackQuery(/^folder:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data
    const folderIdStr = data.replace('folder:', '')

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const db = ctx.getDB()
      const chats = await getAccountChats(db, account.id)

      // Filter chats by folder
      let filteredChats = chats
      if (folderIdStr !== 'all') {
        const folderId = Number.parseInt(folderIdStr, 10)
        filteredChats = chats.filter(chat => chat.folderIds?.includes(folderId))
      }

      if (filteredChats.length === 0) {
        await gramCtx.answerCallbackQuery('No chats in this folder.')
        return
      }

      // Update user state
      const state = userStates.get(userId) || { mode: 'idle' }
      state.mode = 'selecting_chat'
      state.folderId = folderIdStr === 'all' ? undefined : Number.parseInt(folderIdStr, 10)
      state.chatListPage = 0
      userStates.set(userId, state)

      await gramCtx.answerCallbackQuery()
      await showChatList(gramCtx, filteredChats, 0, 'Select a chat to search in:')
    }
    catch (error) {
      logger.withError(error).error('Folder selection failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle chat selection
  bot.callbackQuery(/^chat:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data
    const chatId = data.replace('chat:', '')

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      // Determine chat name
      let chatName = 'Selected chat'
      if (chatId === '__ALL__') {
        chatName = 'All Chats'
      }
      else {
        const db = ctx.getDB()
        const chats = await getAccountChats(db, account.id)
        const selectedChat = chats.find(c => c.id === chatId)
        if (selectedChat) {
          chatName = selectedChat.name
        }
      }

      // Update user state
      const state = userStates.get(userId) || { mode: 'idle' }
      state.mode = 'searching'
      state.chatId = chatId
      userStates.set(userId, state)

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(
        `✅ Selected: ${chatName}\n\n💬 Now send me your search query:`,
      )
    }
    catch (error) {
      logger.withError(error).error('Chat selection failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle chat list pagination
  bot.callbackQuery(/^chatpage:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data
    const page = Number.parseInt(data.replace('chatpage:', ''), 10)

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const state = userStates.get(userId)
      if (!state) {
        await gramCtx.answerCallbackQuery('Session expired.')
        return
      }

      const db = ctx.getDB()
      const chats = await getAccountChats(db, account.id)

      // Filter chats by folder
      let filteredChats = chats
      if (state.folderId !== undefined) {
        filteredChats = chats.filter(chat => chat.folderIds?.includes(state.folderId!))
      }

      state.chatListPage = page
      userStates.set(userId, state)

      await gramCtx.answerCallbackQuery()
      await showChatList(gramCtx, filteredChats, page, 'Select a chat to search in:')
    }
    catch (error) {
      logger.withError(error).error('Chat page navigation failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle search chat by name
  bot.callbackQuery(/^action:search_chat$/, async (gramCtx) => {
    const userId = gramCtx.from.id

    const state = userStates.get(userId) || { mode: 'idle' }
    state.mode = 'text_search_chat'
    userStates.set(userId, state)

    await gramCtx.answerCallbackQuery()
    await gramCtx.editMessageText(
      '🔍 Type the chat name to search:\n\n(Partial match supported)',
    )
  })

  // Handle back to folder selection
  bot.callbackQuery(/^action:back_folder$/, async (gramCtx) => {
    const userId = gramCtx.from.id

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const db = ctx.getDB()

      // Get folders from database
      const foldersResult = await ctx.models.chatFolderModels.findFoldersByAccountId(db, account.id)
      const folders = foldersResult.expect('Failed to get folders')

      // Reset user state
      const state = userStates.get(userId) || { mode: 'idle' }
      state.mode = 'selecting_folder'
      state.folderId = undefined
      state.chatId = undefined
      state.chatListPage = 0
      userStates.set(userId, state)

      // Show folder selection again
      const keyboard = new InlineKeyboard()
      keyboard.text('🌐 All Chats', 'folder:all').row()

      for (const folder of folders) {
        const icon = folder.emoticon || '📁'
        const name = folder.title
        keyboard.text(`${icon} ${name}`, `folder:${folder.id}`).row()
      }

      keyboard.text('🔍 Search Chat by Name', 'action:search_chat').row()

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(
        '🔍 Select where to search:',
        { reply_markup: keyboard },
      )
    }
    catch (error) {
      logger.withError(error).error('Back to folder failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle continue search
  bot.callbackQuery(/^action:continue_search$/, async (gramCtx) => {
    const userId = gramCtx.from.id

    const state = userStates.get(userId)
    if (!state || !state.chatId) {
      await gramCtx.answerCallbackQuery('Session expired. Please /search again.')
      return
    }

    state.mode = 'searching'
    userStates.set(userId, state)

    await gramCtx.answerCallbackQuery()
    await gramCtx.reply('💬 Send me a new search query:')
  })

  // Handle end search
  bot.callbackQuery(/^action:end_search$/, async (gramCtx) => {
    const userId = gramCtx.from.id

    userStates.delete(userId)

    await gramCtx.answerCallbackQuery('Search ended.')
    await gramCtx.reply('Search session ended. Type /search to start a new search.')
  })

  // Handle result page navigation
  bot.callbackQuery(/^resultpage:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data
    const page = Number.parseInt(data.replace('resultpage:', ''), 10)

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

      // Update page in state
      state.resultPage = page
      userStates.set(userId, state)

      // Build keyboard with pagination
      const keyboard = new InlineKeyboard()

      const navButtons = []
      if (page > 0) {
        navButtons.push({ text: '⬅️ Prev Page', callback_data: `resultpage:${page - 1}` })
      }
      if (searchResult.hasMore) {
        navButtons.push({ text: '➡️ Next Page', callback_data: `resultpage:${page + 1}` })
      }
      if (navButtons.length > 0) {
        keyboard.row(...navButtons)
      }

      keyboard.text('🔄 Switch Chat', 'action:back_folder')
      keyboard.text('🔍 New Query', 'action:continue_search').row()
      keyboard.text('❌ End Search', 'action:end_search').row()

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(searchResult.text, { reply_markup: keyboard })
    }
    catch (error) {
      logger.withError(error).error('Result page navigation failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle search query input
  bot.on('message:text', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      return
    }

    const text = gramCtx.message.text

    // Skip commands
    if (text.startsWith('/')) {
      return
    }

    const state = userStates.get(userId)
    if (!state) {
      return
    }

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.reply('Your account is not linked.')
      return
    }

    try {
      const db = ctx.getDB()

      // Handle text search for chat
      if (state.mode === 'text_search_chat') {
        const chats = await getAccountChats(db, account.id)
        const query = text.toLowerCase()

        // Fuzzy match chat names
        const matches = chats.filter(chat =>
          chat.name.toLowerCase().includes(query),
        ).slice(0, 10)

        if (matches.length === 0) {
          await gramCtx.reply('No chats found matching your query. Try again or type /search to start over.')
          return
        }

        // Show matched chats
        const keyboard = new InlineKeyboard()
        for (const chat of matches) {
          const icon = chat.type === 'group' ? '👥' : chat.type === 'channel' ? '📢' : '💬'
          const displayName = sanitizeText(chat.name).slice(0, 40)
          if (displayName) {
            keyboard.text(`${icon} ${displayName}`, `chat:${chat.id}`).row()
          }
        }

        keyboard.text('🔙 Back to Folders', 'action:back_folder').row()

        await gramCtx.reply(
          `Found ${matches.length} matching chat(s):`,
          { reply_markup: keyboard },
        )
        return
      }

      // Handle search query
      if (state.mode === 'searching' && state.chatId) {
        await gramCtx.reply('🔍 Searching...')

        const searchChatId = state.chatId
        const searchResult = await executeSearchWithPagination(ctx, account.id, text, searchChatId, 0)

        // Save query and last search chat ID
        state.query = text
        state.resultPage = 0
        userStates.set(userId, state)

        const accountResult = await ctx.models.accountModels.findAccountByUUID(db, account.id)
        const accountData = accountResult.expect('Account not found')

        const updatedSettings = {
          ...accountData.settings,
          bot: {
            ...accountData.settings?.bot,
            lastSearchChatId: searchChatId,
          } as any,
        }

        await ctx.models.accountSettingsModels.updateAccountSettings(db, account.id, updatedSettings)

        // Show result with action buttons
        const keyboard = new InlineKeyboard()

        // Add pagination buttons if needed
        const navButtons = []
        if (searchResult.hasMore) {
          navButtons.push({ text: '➡️ Next Page', callback_data: 'resultpage:1' })
        }
        if (navButtons.length > 0) {
          keyboard.row(...navButtons)
        }

        keyboard.text('🔄 Switch Chat', 'action:back_folder')
        keyboard.text('🔍 New Query', 'action:continue_search').row()
        keyboard.text('❌ End Search', 'action:end_search').row()

        await gramCtx.reply(searchResult.text, { reply_markup: keyboard })
      }
    }
    catch (error) {
      logger.withError(error).error('Search execution failed')
      await gramCtx.reply('An error occurred while searching. Please try again later.')
    }
  })
}

/**
 * Display paginated chat list
 */
async function showChatList(
  gramCtx: any,
  chats: any[],
  page: number,
  message: string,
) {
  const keyboard = new InlineKeyboard()

  // Add "Search All Chats" option at the top (only on first page)
  if (page === 0) {
    keyboard.text('🌐 Search All Chats', 'chat:__ALL__').row()
  }

  const startIdx = page * CHATS_PER_PAGE
  const endIdx = startIdx + CHATS_PER_PAGE
  const pageChats = chats.slice(startIdx, endIdx)
  const totalPages = Math.ceil(chats.length / CHATS_PER_PAGE)

  for (const chat of pageChats) {
    const icon = chat.type === 'group' ? '👥' : chat.type === 'channel' ? '📢' : '💬'
    const displayName = sanitizeText(chat.name).slice(0, 40)

    if (!displayName) {
      continue
    }

    keyboard.text(`${icon} ${displayName}`, `chat:${chat.id}`).row()
  }

  // Add pagination buttons
  if (totalPages > 1) {
    const navButtons = []
    if (page > 0) {
      navButtons.push({ text: '⬅️ Prev', callback_data: `chatpage:${page - 1}` })
    }
    if (page < totalPages - 1) {
      navButtons.push({ text: '➡️ Next', callback_data: `chatpage:${page + 1}` })
    }
    if (navButtons.length > 0) {
      keyboard.row(...navButtons)
    }
  }

  // Add back button
  keyboard.text('🔙 Back to Folders', 'action:back_folder').row()

  const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : ''
  await gramCtx.editMessageText(
    `${message}${pageInfo}`,
    { reply_markup: keyboard },
  )
}

/**
 * Helper to sanitize button text (remove problematic characters)
 */
function sanitizeText(text: string): string {
  return text
    // eslint-disable-next-line sonarjs/no-control-regex, no-control-regex
    .replace(/[\u0000-\u0008\v\f\u000E-\u001F\u007F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .trim()
}

/**
 * Execute search with pagination support
 *
 * Note: Vector search doesn't support offset, so we fetch (page+1)*limit results
 * and slice in application layer
 */
async function executeSearchWithPagination(
  ctx: BotCommandContext,
  accountId: string,
  query: string,
  chatId: string,
  page: number = 0,
): Promise<{ text: string, hasMore: boolean }> {
  const logger = ctx.logger.withContext('bot:search:execute')
  const db = ctx.getDB()

  const limit = 10
  const startIdx = page * limit
  const endIdx = startIdx + limit

  // Fetch enough results to cover this page + check if there's more
  // Vector search doesn't support offset, so we fetch from start and slice
  const fetchLimit = endIdx + 1

  // Build filters - if chatId is __ALL__, search all chats
  const filters = chatId === '__ALL__'
    ? {} // No chat filter - search all chats
    : { chatIds: [chatId] }

  const result = await ctx.models.chatMessageModels.retrieveMessages(
    db,
    logger,
    accountId,
    undefined,
    DEFAULT_EMBEDDING_DIMENSION,
    { text: query },
    { limit: fetchLimit, offset: 0 },
    filters,
  )

  const allMessages = result.expect('Failed to search messages')

  // Slice to get current page
  const hasMore = allMessages.length > endIdx
  const messages = allMessages.slice(startIdx, endIdx)

  if (messages.length === 0) {
    return {
      text: page === 0
        ? `No results found for "${query}" in selected chat.`
        : `No more results for "${query}".`,
      hasMore: false,
    }
  }

  const lines = messages.map((msg, index) => {
    const from = msg.from_name || msg.from_id || 'Unknown'
    const chat = msg.chat_name || msg.in_chat_id || 'Unknown chat'
    const content = (msg.content ?? '').slice(0, 200)
    const time = msg.platform_timestamp
      ? new Date(msg.platform_timestamp * 1000).toLocaleString()
      : 'Unknown time'
    return `${startIdx + index + 1}. [${chat}] ${from} (${time}):\n${content}`
  })

  const pageInfo = page > 0 ? ` (Page ${page + 1})` : ''
  const header = `Found results for "${query}"${pageInfo}:\n\n`

  return {
    text: header + lines.join('\n\n'),
    hasMore,
  }
}

/**
 * Execute search and return formatted results (backward compatibility for inline mode)
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
