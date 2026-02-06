import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'

import { generateMessageLink } from '../utils/deep-link'
import { sanitizeText } from './helpers'

const CONTEXT_MESSAGES_COUNT = 5 // Messages before/after

interface ContextState {
  chatId: string
  messageId: string
  chatType: string
  chatUsername?: string | null
  chatName: string
  beforeCount: number
  afterCount: number
}

const contextStates = new Map<number, ContextState>()

/**
 * Register context-related callback handlers for viewing message context
 */
export function registerContextCallbacks(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:context')

  // Handle "View Context" button from search results
  // Format: ctx:{chatId}:{messageId}
  bot.callbackQuery(/^ctx:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data
    const parts = data.split(':')
    if (parts.length < 3) {
      await gramCtx.answerCallbackQuery('Invalid context data.')
      return
    }
    const chatId = parts[1]
    const messageId = parts[2]

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const db = ctx.getDB()

      // Get chat info for link generation
      const chatsResult = await ctx.models.chatModels.fetchChatsByAccountId(db, account.id)
      const chats = chatsResult.expect('Failed to get chats')
      const chat = chats.find(c => c.chat_id === chatId)

      if (!chat) {
        await gramCtx.answerCallbackQuery('Chat not found.')
        return
      }

      // Store context state
      contextStates.set(userId, {
        chatId,
        messageId,
        chatType: chat.chat_type || 'unknown',
        chatUsername: chat.chat_username,
        chatName: chat.chat_name || chatId,
        beforeCount: CONTEXT_MESSAGES_COUNT,
        afterCount: CONTEXT_MESSAGES_COUNT,
      })

      // Generate deep link
      const linkResult = generateMessageLink(
        { chatId, chatType: chat.chat_type || 'unknown', chatUsername: chat.chat_username },
        messageId,
      )

      const keyboard = new InlineKeyboard()

      // Add link button if available
      if (linkResult.url) {
        keyboard.url('🔗 Open in Telegram', linkResult.url).row()
        if (linkResult.type === 'private') {
          keyboard.text('📖 View Context Here', `ctxshow:${chatId}:${messageId}`).row()
        }
      }
      else {
        // No link available - offer to show context in bot
        keyboard.text('📖 View Context', `ctxshow:${chatId}:${messageId}`).row()
      }

      keyboard.text('🔙 Back to Results', 'action:back_results').row()

      let text = `📍 Message Context\n\nChat: ${chat.chat_name || chatId}`
      if (linkResult.url) {
        text += `\n\n${linkResult.type === 'private' ? '🔒 Private link (you must be a member)' : '🌐 Public link'}`
      }
      else {
        text += `\n\n⚠️ ${linkResult.reason}`
      }

      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText(text, { reply_markup: keyboard })
    }
    catch (error) {
      logger.withError(error).error('Context fetch failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle context display within bot
  // Format: ctxshow:{chatId}:{messageId}
  bot.callbackQuery(/^ctxshow:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data
    const parts = data.split(':')
    if (parts.length < 3) {
      await gramCtx.answerCallbackQuery('Invalid context data.')
      return
    }
    const chatId = parts[1]
    const messageId = parts[2]

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      // Get or create context state
      let state = contextStates.get(userId)
      if (!state || state.chatId !== chatId || state.messageId !== messageId) {
        const db = ctx.getDB()
        const chatsResult = await ctx.models.chatModels.fetchChatsByAccountId(db, account.id)
        const chats = chatsResult.expect('Failed to get chats')
        const chat = chats.find(c => c.chat_id === chatId)

        state = {
          chatId,
          messageId,
          chatType: chat?.chat_type || 'unknown',
          chatUsername: chat?.chat_username,
          chatName: chat?.chat_name || chatId,
          beforeCount: CONTEXT_MESSAGES_COUNT,
          afterCount: CONTEXT_MESSAGES_COUNT,
        }
        contextStates.set(userId, state)
      }

      await showMessageContext(gramCtx, ctx, account.id, state)
    }
    catch (error) {
      logger.withError(error).error('Context display failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle load more context
  // Format: ctxmore:{chatId}:{messageId}:{direction}
  bot.callbackQuery(/^ctxmore:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const data = gramCtx.callbackQuery.data
    const parts = data.split(':')
    if (parts.length < 4) {
      await gramCtx.answerCallbackQuery('Invalid context data.')
      return
    }
    const chatId = parts[1]
    const messageId = parts[2]
    const direction = parts[3] as 'before' | 'after'

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      const state = contextStates.get(userId)
      if (!state || state.chatId !== chatId || state.messageId !== messageId) {
        await gramCtx.answerCallbackQuery('Session expired. Please try again.')
        return
      }

      // Increase context window
      if (direction === 'before') {
        state.beforeCount += CONTEXT_MESSAGES_COUNT
      }
      else {
        state.afterCount += CONTEXT_MESSAGES_COUNT
      }
      contextStates.set(userId, state)

      await showMessageContext(gramCtx, ctx, account.id, state)
    }
    catch (error) {
      logger.withError(error).error('Load more context failed')
      await gramCtx.answerCallbackQuery('An error occurred.')
    }
  })

  // Handle back to results action
  bot.callbackQuery(/^action:back_results$/, async (gramCtx) => {
    const userId = gramCtx.from.id

    // Clear context state
    contextStates.delete(userId)

    await gramCtx.answerCallbackQuery()
    await gramCtx.editMessageText(
      'Context closed. Use /search to search again or press the search buttons in the previous message.',
    )
  })
}

/**
 * Display message context with surrounding messages
 */
async function showMessageContext(
  gramCtx: {
    answerCallbackQuery: (text?: string) => Promise<boolean>
    editMessageText: (text: string, other?: { reply_markup?: InlineKeyboard }) => Promise<unknown>
  },
  ctx: BotCommandContext,
  accountId: string,
  state: ContextState,
) {
  const db = ctx.getDB()

  // Fetch context using existing model
  const contextResult = await ctx.models.chatMessageModels.fetchMessageContextWithPhotos(
    db,
    ctx.models.photoModels,
    accountId,
    {
      chatId: state.chatId,
      messageId: state.messageId,
      before: state.beforeCount,
      after: state.afterCount,
    },
  )

  const messages = contextResult.expect('Failed to fetch context')

  if (messages.length === 0) {
    await gramCtx.answerCallbackQuery('No messages found.')
    return
  }

  // Format messages
  const lines = messages.map((msg) => {
    const isTarget = msg.platformMessageId === state.messageId
    const prefix = isTarget ? '>>> ' : '    '
    const from = msg.fromName || msg.fromId || 'Unknown'
    const time = msg.platformTimestamp
      ? new Date(msg.platformTimestamp * 1000).toLocaleTimeString()
      : ''
    const content = sanitizeText(msg.content || '').slice(0, 150)
    const suffix = isTarget ? ' <<<' : ''
    return `${prefix}[${time}] ${from}:\n${prefix}${content}${suffix}`
  })

  // Build keyboard
  const keyboard = new InlineKeyboard()

  // Add link button if available
  const linkResult = generateMessageLink(
    { chatId: state.chatId, chatType: state.chatType, chatUsername: state.chatUsername },
    state.messageId,
  )
  if (linkResult.url) {
    keyboard.url('🔗 Open in Telegram', linkResult.url).row()
  }

  // Load more buttons
  keyboard
    .text('⬆️ Load Before', `ctxmore:${state.chatId}:${state.messageId}:before`)
    .text('⬇️ Load After', `ctxmore:${state.chatId}:${state.messageId}:after`)
    .row()

  keyboard.text('🔙 Back', 'action:back_results').row()

  const header = `📖 Context - ${state.chatName}\n(${state.beforeCount} before, ${state.afterCount} after)\n\n`

  await gramCtx.answerCallbackQuery()
  await gramCtx.editMessageText(header + lines.join('\n\n'), { reply_markup: keyboard })
}
