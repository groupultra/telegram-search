import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { CoreEventType } from '@tg-search/core'
import { InlineKeyboard } from 'grammy'

import { createChatPicker } from './chat-picker'

type ExportMode = 'full' | 'incremental'

interface UserExportState {
  chatId: string
  chatName: string
}

const userStates = new Map<number, UserExportState>()

export function registerExportCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:export')

  const picker = createChatPicker(bot, ctx, {
    prefix: 'E',
    folderHeader: '📤 Select chats to export:',
    chatListHeader: '📤 Select a chat to export:',
    allOptionLabel: '🌐 Export All Chats',
    onSelected: async (gramCtx, userId, chatId, chatName) => {
      userStates.set(userId, { chatId, chatName })

      const keyboard = new InlineKeyboard()
        .text('📦 Full Export', 'expmode:full')
        .row()
        .text('🔄 Incremental Sync', 'expmode:incremental')
        .row()
        .text('🔙 Back', picker.backCallbackData)

      await gramCtx.editMessageText(
        `📤 Export: ${chatName}\n\nChoose export mode:`,
        { reply_markup: keyboard },
      )
    },
    onReset: (userId) => {
      userStates.delete(userId)
    },
  })

  bot.command('export', async (gramCtx) => {
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
      await picker.showFolders(gramCtx, userId)
    }
    catch (error) {
      logger.withError(error).error('Export command failed')
      await gramCtx.reply('An error occurred. Please try again later.')
    }
  })

  bot.callbackQuery(/^expmode:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const mode = gramCtx.callbackQuery.data.replace('expmode:', '') as ExportMode

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    const state = userStates.get(userId)
    if (!state) {
      await gramCtx.answerCallbackQuery('Session expired. Please /export again.')
      return
    }

    const coreCtx = ctx.getAccountContext(account.id)
    if (!coreCtx) {
      await gramCtx.answerCallbackQuery('Account session not ready. Please log in via the web interface first.')
      return
    }

    try {
      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText('📤 Starting export...')

      const chatIds = state.chatId === '__ALL__' ? [] : [state.chatId]
      const increase = mode === 'incremental'

      coreCtx.emitter.emit(CoreEventType.TakeoutRun, {
        chatIds,
        increase,
        syncOptions: {},
      })

      const modeLabel = mode === 'incremental' ? 'Incremental Sync' : 'Full Export'
      await gramCtx.editMessageText(
        `✅ ${modeLabel} started for ${state.chatName}.\n\nCheck the web interface for progress.`,
      )

      userStates.delete(userId)
      picker.clearState(userId)
    }
    catch (error) {
      logger.withError(error).error('Export flow failed')
      await gramCtx.reply('❌ Failed to start export. Please try again later.')
    }
  })
}
