import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'

import { getAccountChats } from './helpers'

const DEFAULT_EMBEDDING_DIMENSION = 1536

// In-memory store for pending searches (userId -> chatId)
const pendingSearches = new Map<number, string>()

export function registerSearchCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:search')

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

      // Get account settings to retrieve last search chat
      const accountResult = await ctx.models.accountModels.findAccountByUUID(db, account.id)
      const accountData = accountResult.expect('Account not found')
      const lastSearchChatId = (accountData.settings?.bot as any)?.lastSearchChatId as string | undefined

      // Get user's chats for scope selection
      const chats = await getAccountChats(db, account.id)

      if (chats.length === 0) {
        await gramCtx.reply('You have no chats yet. Please sync your messages first.')
        return
      }

      // Build inline keyboard with chat options
      const keyboard = new InlineKeyboard()

      // Helper to sanitize button text (remove problematic characters)
      const sanitizeText = (text: string): string => {
        // Remove any non-UTF-8 characters (i.e., keep only valid Unicode scalar values)
        // Here we match any invalid surrogate pairs and ASCII control characters except \t and \n
        // Most JS strings are UTF-16, but to restrict to good Unicode text:
        return text
          // Remove ASCII control characters except tab and line feed
          .replace(/[\u0000-\u0008\v\f\u000E-\u001F\u007F]/g, '')
          // Remove invalid surrogate code units (lone surrogates)
          .replace(/[\uD800-\uDFFF]/g, '')
          .trim()
      }

      // Add "Last Used" option if available
      if (lastSearchChatId) {
        const lastChat = chats.find(c => c.id === lastSearchChatId)
        if (lastChat) {
          const rawName = lastChat.name.length > 25 ? `${lastChat.name.slice(0, 25)}...` : lastChat.name
          const displayName = sanitizeText(rawName)
          if (displayName) {
            keyboard.text(
              `⭐ Last: ${displayName}`,
              `selectchat:${lastChat.id}`,
            ).row()
          }
        }
      }

      // Add "All Chats" option
      keyboard.text('🌐 All Chats', 'selectchat:all').row()

      // Add individual chat options (limit to 7 to make room for "last used")
      const maxChats = lastSearchChatId ? 7 : 8
      const otherChats = lastSearchChatId
        ? chats.filter(c => c.id !== lastSearchChatId).slice(0, maxChats)
        : chats.slice(0, maxChats)

      for (const chat of otherChats) {
        const rawName = chat.name.length > 30 ? `${chat.name.slice(0, 30)}...` : chat.name
        const displayName = sanitizeText(rawName)

        // Skip chats with empty names after sanitization
        if (!displayName) {
          continue
        }

        keyboard.text(
          `${displayName}`,
          `selectchat:${chat.id}`,
        ).row()
      }

      const totalOtherChats = lastSearchChatId ? chats.length - 1 : chats.length
      if (totalOtherChats > maxChats) {
        keyboard.text(`... and ${totalOtherChats - maxChats} more`, 'selectchat:noop').row()
      }

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

  // Handle chat selection
  bot.callbackQuery(/^selectchat:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    const chatId = data.replace('selectchat:', '')

    // Handle noop
    if (chatId === 'noop') {
      await gramCtx.answerCallbackQuery('Please select a chat from the list above.')
      return
    }

    // Store pending search
    pendingSearches.set(userId, chatId)

    // Get chat name for confirmation
    const db = ctx.getDB()
    const chats = await getAccountChats(db, account.id)
    const selectedChat = chatId === 'all' ? null : chats.find(c => c.id === chatId)
    const chatName = selectedChat ? selectedChat.name : 'All Chats'

    await gramCtx.answerCallbackQuery()
    await gramCtx.editMessageText(
      `✅ Selected: ${chatName}\n\n💬 Now send me your search query:`,
    )
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

    // Check if user has pending search
    const chatId = pendingSearches.get(userId)
    if (!chatId) {
      return
    }

    // Clear pending search
    pendingSearches.delete(userId)

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.reply('Your account is not linked.')
      return
    }

    await gramCtx.reply('🔍 Searching...')

    try {
      const searchChatId = chatId === 'all' ? undefined : chatId
      const resultText = await executeSearch(ctx, account.id, text, searchChatId)

      // Save last search chat ID (if not "all")
      if (searchChatId) {
        const db = ctx.getDB()
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
      }

      await gramCtx.reply(resultText)
    }
    catch (error) {
      logger.withError(error).error('Search execution failed')
      await gramCtx.reply('An error occurred while searching. Please try again later.')
    }
  })
}

/**
 * Execute search and return formatted results
 */
export async function executeSearch(
  ctx: BotCommandContext,
  accountId: string,
  query: string,
  chatId?: string,
) {
  const logger = ctx.logger.withContext('bot:search:execute')
  const db = ctx.getDB()

  const result = await ctx.models.chatMessageModels.retrieveMessages(
    db,
    logger,
    accountId,
    undefined,
    DEFAULT_EMBEDDING_DIMENSION,
    { text: query },
    { limit: 10, offset: 0 },
    chatId ? { chatIds: [chatId] } : undefined,
  )

  const messages = result.expect('Failed to search messages')

  if (messages.length === 0) {
    return `No results found for "${query}"${chatId ? ' in selected chat' : ''}.`
  }

  const lines = messages.map((msg, index) => {
    const from = msg.from_name || msg.from_id || 'Unknown'
    const chat = msg.chat_name || msg.in_chat_id || 'Unknown chat'
    const content = (msg.content ?? '').slice(0, 200)
    const time = msg.platform_timestamp
      ? new Date(msg.platform_timestamp * 1000).toLocaleString()
      : 'Unknown time'
    return `${index + 1}. [${chat}] ${from} (${time}):\n${content}`
  })

  const scope = chatId ? 'in selected chat' : 'across all chats'
  const header = `Found ${messages.length} result(s) for "${query}" ${scope}:\n\n`
  return header + lines.join('\n\n')
}
