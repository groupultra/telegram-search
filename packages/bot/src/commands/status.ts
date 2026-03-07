import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

export function registerStatusCommand(bot: Bot, ctx: BotCommandContext) {
  bot.command('status', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      await gramCtx.reply('Could not identify you.')
      return
    }

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.reply(
        'Status: Not logged in\n\n'
        + 'Use /login to connect your Telegram account.',
      )
      return
    }

    const coreCtx = ctx.getAccountContext(account.id)
    if (!coreCtx) {
      await gramCtx.reply(
        'Status: Account linked but no active session\n\n'
        + 'Use /login to reconnect.',
      )
      return
    }

    try {
      const client = coreCtx.getClient()
      const connected = client?.connected ?? false
      const myUser = coreCtx.getMyUser()

      const lines = [
        `Status: ${connected ? 'Connected' : 'Disconnected'}`,
        `Account: ${myUser.name} (@${myUser.username || 'N/A'})`,
        `User ID: ${myUser.id}`,
      ]

      // Fetch chat count
      try {
        const db = ctx.getDB()
        const chatsResult = await ctx.models.chatModels.fetchChatsByAccountId(db, account.id)
        const chats = chatsResult.expect('Failed to get chats')
        lines.push(`Synced Chats: ${chats.length}`)
      }
      catch {
        // Ignore chat count errors
      }

      lines.push(
        '',
        'Available commands:',
        '/search - Search messages',
        '/export - Export/sync messages',
        '/summary - Get message summaries',
        '/logout - Disconnect',
      )

      await gramCtx.reply(lines.join('\n'))
    }
    catch {
      await gramCtx.reply(
        'Status: Session active (details unavailable)\n\n'
        + 'The account context exists but some details could not be retrieved.',
      )
    }
  })
}
