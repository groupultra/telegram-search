import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { EmbeddingDimension } from '@tg-search/core'

export function registerSummaryCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:summary')

  bot.command('summary', async (gramCtx) => {
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

    await gramCtx.reply('Fetching recent messages for summary...')

    try {
      const db = ctx.getDB()

      const oneDayAgo = Math.floor(Date.now() / 1000) - 86400
      const result = await ctx.models.chatMessageModels.retrieveMessages(
        db,
        logger,
        account.id,
        undefined,
        EmbeddingDimension.DIMENSION_1536,
        { text: undefined },
        { limit: 50, offset: 0 },
        { timeRange: { start: oneDayAgo } },
      )

      const messages = result.expect('Failed to fetch messages for summary')
      if (messages.length === 0) {
        await gramCtx.reply('No messages found in the last 24 hours.')
        return
      }

      const chatGroups = new Map<string, { name: string, count: number }>()
      for (const msg of messages) {
        const chatId = msg.in_chat_id || 'unknown'
        const existing = chatGroups.get(chatId)
        if (existing) {
          existing.count++
        }
        else {
          chatGroups.set(chatId, {
            name: msg.chat_name || chatId,
            count: 1,
          })
        }
      }

      const lines = Array.from(chatGroups.values())
        .sort((a, b) => b.count - a.count)
        .map(g => `  ${g.name}: ${g.count} messages`)

      const reply = [
        `Message Summary (last 24h):`,
        `Total: ${messages.length} messages across ${chatGroups.size} chats\n`,
        ...lines,
        `\nUse /search <query> to search through these messages.`,
      ].join('\n')

      await gramCtx.reply(reply)
    }
    catch (error) {
      logger.withError(error).error('Summary command failed')
      await gramCtx.reply('An error occurred while generating the summary. Please try again later.')
    }
  })
}
