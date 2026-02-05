import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

// EmbeddingDimension.DIMENSION_1536 = 1536
const DEFAULT_EMBEDDING_DIMENSION = 1536

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

    const query = gramCtx.match?.trim()
    if (!query) {
      await gramCtx.reply('Usage: /search <query>\nExample: /search meeting notes')
      return
    }

    await gramCtx.reply(`Searching for: "${query}"...`)

    try {
      const db = ctx.getDB()
      const result = await ctx.models.chatMessageModels.retrieveMessages(
        db,
        logger,
        account.id,
        undefined,
        DEFAULT_EMBEDDING_DIMENSION as any,
        { text: query },
        { limit: 10, offset: 0 },
      )

      const messages = result.expect('Failed to search messages')
      if (messages.length === 0) {
        await gramCtx.reply(`No results found for "${query}".`)
        return
      }

      const lines = messages.map((msg: any, i: number) => {
        const from = msg.from_name || msg.from_id || 'Unknown'
        const chat = msg.chat_name || msg.in_chat_id || 'Unknown chat'
        const content = (msg.content || '').slice(0, 200)
        const time = msg.platform_timestamp
          ? new Date(msg.platform_timestamp * 1000).toLocaleString()
          : 'Unknown time'
        return `${i + 1}. [${chat}] ${from} (${time}):\n${content}`
      })

      const header = `Found ${messages.length} result(s) for "${query}":\n\n`
      await gramCtx.reply(header + lines.join('\n\n'))
    }
    catch (error) {
      logger.withError(error).error('Search command failed')
      await gramCtx.reply('An error occurred while searching. Please try again later.')
    }
  })
}
