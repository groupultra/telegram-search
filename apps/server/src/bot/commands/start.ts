import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

export function registerStartCommand(bot: Bot, ctx: BotCommandContext) {
  bot.command('start', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      await gramCtx.reply('Could not identify you. Please try again.')
      return
    }

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (account) {
      await gramCtx.reply(
        `Welcome back! Your account is linked.\n\n`
        + `Available commands:\n`
        + `/search <query> - Search your message history\n`
        + `/summary - Get a summary of recent messages\n`
        + `/schedule - Manage scheduled summaries`,
      )
    }
    else {
      await gramCtx.reply(
        `Welcome to Telegram Search Bot!\n\n`
        + `Your Telegram account is not linked yet. `
        + `Please log in through the web interface first, `
        + `then come back here to use bot features.\n\n`
        + `Once linked, you can:\n`
        + `/search <query> - Search your message history\n`
        + `/summary - Get a summary of recent messages\n`
        + `/schedule - Manage scheduled summaries`,
      )
    }
  })
}
