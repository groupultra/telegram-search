import type { Bot, Context } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'

import { getAccountChats, getChatTypeIcon, sanitizeText } from './helpers'

const CHATS_PER_PAGE = 8

export interface ChatPickerConfig {
  /** Short prefix for callback data namespacing (e.g., 'S' for search, 'M' for summary) */
  prefix: string
  /** Header text shown during folder selection */
  folderHeader: string
  /** Header text shown during chat list */
  chatListHeader: string
  /** Label for the "select all" option in chat list */
  allOptionLabel: string
  /** Called when user selects a chat */
  onSelected: (gramCtx: Context, userId: number, chatId: string, chatName: string) => Promise<void>
  /** If provided, shows a "Search by Name" button; called on click */
  onSearchByName?: (gramCtx: Context, userId: number) => Promise<void>
  /** Called when user navigates back to folder list (for resetting command state) */
  onReset?: (userId: number) => void
}

interface PickerState {
  folderId?: number
  chatListPage: number
}

/**
 * Factory that registers folder -> chat selection callbacks on the bot
 * and returns helpers to initiate/manage the flow.
 *
 * Each picker instance uses `prefix` to namespace callback data, so
 * multiple pickers (search, summary, etc.) coexist without collision.
 */
export function createChatPicker(bot: Bot, ctx: BotCommandContext, config: ChatPickerConfig) {
  const { prefix } = config
  const logger = ctx.logger.withContext(`bot:picker:${prefix}`)
  const states = new Map<number, PickerState>()

  // Callback data keys – kept short for Telegram's 64-byte limit
  const CB_FOLDER = `${prefix}f:`
  const CB_CHAT = `${prefix}c:`
  const CB_PAGE = `${prefix}p:`
  const CB_BACK = `${prefix}bf`
  const CB_SEARCH = `${prefix}sn`

  // --- Internal helpers ---

  async function getFilteredChats(accountId: string, folderId?: number) {
    const db = ctx.getDB()
    const chats = await getAccountChats(db, accountId)
    if (folderId === undefined)
      return chats
    return chats.filter(chat => chat.folderIds?.includes(folderId))
  }

  async function buildFolderKeyboard(userId: number): Promise<InlineKeyboard> {
    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account)
      throw new Error('Account not linked')

    const db = ctx.getDB()
    const foldersResult = await ctx.models.chatFolderModels.findFoldersByAccountId(db, account.id)
    const folders = foldersResult.expect('Failed to get folders')

    states.set(userId, { chatListPage: 0 })

    const keyboard = new InlineKeyboard()
    keyboard.text('🌐 All Chats', `${CB_FOLDER}all`).row()

    for (const folder of folders) {
      const icon = folder.emoticon || '📁'
      keyboard.text(`${icon} ${folder.title}`, `${CB_FOLDER}${folder.id}`).row()
    }

    if (config.onSearchByName) {
      keyboard.text('🔍 Search Chat by Name', CB_SEARCH).row()
    }

    return keyboard
  }

  function buildChatListKeyboard(
    chats: Array<{ id: string, name: string, type: string }>,
    page: number,
  ): { keyboard: InlineKeyboard, pageInfo: string } {
    const keyboard = new InlineKeyboard()

    if (page === 0) {
      keyboard.text(config.allOptionLabel, `${CB_CHAT}__ALL__`).row()
    }

    const startIdx = page * CHATS_PER_PAGE
    const endIdx = startIdx + CHATS_PER_PAGE
    const pageChats = chats.slice(startIdx, endIdx)
    const totalPages = Math.ceil(chats.length / CHATS_PER_PAGE)

    for (const chat of pageChats) {
      const icon = getChatTypeIcon(chat.type)
      const displayName = sanitizeText(chat.name).slice(0, 40)
      if (!displayName)
        continue
      keyboard.text(`${icon} ${displayName}`, `${CB_CHAT}${chat.id}`).row()
    }

    if (totalPages > 1) {
      const navButtons: Array<{ text: string, callback_data: string }> = []
      if (page > 0)
        navButtons.push({ text: '⬅️ Prev', callback_data: `${CB_PAGE}${page - 1}` })
      if (page < totalPages - 1)
        navButtons.push({ text: '➡️ Next', callback_data: `${CB_PAGE}${page + 1}` })
      if (navButtons.length > 0)
        keyboard.row(...navButtons)
    }

    keyboard.text('🔙 Back to Folders', CB_BACK).row()

    const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : ''
    return { keyboard, pageInfo }
  }

  // --- Callback handlers ---

  bot.callbackQuery(new RegExp(`^${prefix}f:`), async (gramCtx) => {
    const userId = gramCtx.from.id
    const folderIdStr = gramCtx.callbackQuery.data.slice(CB_FOLDER.length)

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const folderId = folderIdStr === 'all' ? undefined : Number.parseInt(folderIdStr, 10)
      const filteredChats = await getFilteredChats(account.id, folderId)

      if (filteredChats.length === 0) {
        await gramCtx.answerCallbackQuery('No chats in this folder.')
        return
      }

      states.set(userId, { folderId, chatListPage: 0 })
      const { keyboard, pageInfo } = buildChatListKeyboard(filteredChats, 0)

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(`${config.chatListHeader}${pageInfo}`, { reply_markup: keyboard })
    }
    catch (error) {
      logger.withError(error).error('Folder selection failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  bot.callbackQuery(new RegExp(`^${prefix}c:`), async (gramCtx) => {
    const userId = gramCtx.from.id
    const chatId = gramCtx.callbackQuery.data.slice(CB_CHAT.length)

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      let chatName = 'All Chats'
      if (chatId !== '__ALL__') {
        const db = ctx.getDB()
        const chats = await getAccountChats(db, account.id)
        const selected = chats.find(c => c.id === chatId)
        if (selected)
          chatName = selected.name
      }

      await gramCtx.answerCallbackQuery()
      await config.onSelected(gramCtx, userId, chatId, chatName)
    }
    catch (error) {
      logger.withError(error).error('Chat selection failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  bot.callbackQuery(new RegExp(`^${prefix}p:`), async (gramCtx) => {
    const userId = gramCtx.from.id
    const page = Number.parseInt(gramCtx.callbackQuery.data.slice(CB_PAGE.length), 10)

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const state = states.get(userId)
      if (!state) {
        await gramCtx.answerCallbackQuery('Session expired.')
        return
      }

      const filteredChats = await getFilteredChats(account.id, state.folderId)
      state.chatListPage = page

      const { keyboard, pageInfo } = buildChatListKeyboard(filteredChats, page)

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(`${config.chatListHeader}${pageInfo}`, { reply_markup: keyboard })
    }
    catch (error) {
      logger.withError(error).error('Page navigation failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  bot.callbackQuery(new RegExp(`^${prefix}bf$`), async (gramCtx) => {
    const userId = gramCtx.from.id
    try {
      config.onReset?.(userId)
      const keyboard = await buildFolderKeyboard(userId)

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(config.folderHeader, { reply_markup: keyboard })
    }
    catch (error) {
      logger.withError(error).error('Back to folders failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  if (config.onSearchByName) {
    const handler = config.onSearchByName
    bot.callbackQuery(new RegExp(`^${prefix}sn$`), async (gramCtx) => {
      const userId = gramCtx.from.id
      try {
        await gramCtx.answerCallbackQuery()
        await handler(gramCtx, userId)
      }
      catch (error) {
        logger.withError(error).error('Search by name failed')
        await gramCtx.answerCallbackQuery('An error occurred.')
      }
    })
  }

  // --- Public API ---

  return {
    /** Kick off the picker flow by showing folder selection */
    showFolders: async (gramCtx: Context, userId: number, editMessage = false) => {
      const keyboard = await buildFolderKeyboard(userId)
      if (editMessage) {
        await gramCtx.editMessageText(config.folderHeader, { reply_markup: keyboard })
      }
      else {
        await gramCtx.reply(config.folderHeader, { reply_markup: keyboard })
      }
    },

    /** Callback data for "back to folders" - use in command-specific keyboards */
    backCallbackData: CB_BACK,

    /** Build callback data for selecting a chat - feeds into picker's chat handler */
    chatCallbackData: (chatId: string) => `${CB_CHAT}${chatId}`,

    getState: (userId: number) => states.get(userId),
    clearState: (userId: number) => states.delete(userId),
  }
}
