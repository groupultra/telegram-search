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
        + `/export - Export/sync messages from Telegram\n`
        + `/summary - Get a summary of recent messages\n`
        + `/status - Check connection status\n`
        + `/logout - Disconnect your account`,
      )
    }
    else {
      await gramCtx.reply(
        `Welcome to Telegram Search Bot!\n\n`
        + `Your Telegram account is not linked yet.\n`
        + `Use /login to connect your Telegram account directly, `
        + `or log in through the web interface.\n\n`
        + `Once linked, you can:\n`
        + `/search <query> - Search your message history\n`
        + `/export - Export/sync messages from Telegram\n`
        + `/summary - Get a summary of recent messages\n`
        + `/status - Check connection status`,
      )
    }
  })
}
