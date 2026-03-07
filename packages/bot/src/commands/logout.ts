import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { CoreEventType } from '@tg-search/core'

export function registerLogoutCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:logout')

  bot.command('logout', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      await gramCtx.reply('Could not identify you.')
      return
    }

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.reply('You are not logged in.')
      return
    }

    const coreCtx = ctx.getAccountContext(account.id)
    if (!coreCtx) {
      await gramCtx.reply('No active session found.')
      return
    }

    try {
      await gramCtx.reply('Logging out...')

      coreCtx.emitter.emit(CoreEventType.AuthLogout)

      await gramCtx.reply(
        'You have been logged out.\n\n'
        + 'Use /login to log in again.',
      )
    }
    catch (error) {
      logger.withError(error).error('Logout failed')
      await gramCtx.reply('An error occurred during logout. Please try again.')
    }
  })
}
