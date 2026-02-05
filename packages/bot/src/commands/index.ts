import type { Logger } from '@guiiai/logg'
import type { CoreDB, Models } from '@tg-search/core'
import type { Bot } from 'grammy'

import { registerSearchCommand } from './search'
import { registerStartCommand } from './start'
import { registerSummaryCommand } from './summary'

export interface BotCommandAccount {
  id: string
  platformUserId: string
}

export interface BotCommandContext {
  getDB: () => CoreDB
  models: Models
  resolveAccountByTelegramUserId: (userId: number) => Promise<BotCommandAccount | undefined>
  logger: Logger
}

export function registerCommands(bot: Bot, ctx: BotCommandContext) {
  registerStartCommand(bot, ctx)
  registerSearchCommand(bot, ctx)
  registerSummaryCommand(bot, ctx)

  bot.on('message:text', async (gramCtx) => {
    const text = gramCtx.message.text
    if (!text.startsWith('/')) {
      await gramCtx.reply('Send /search <query> to search your messages, or /summary to get a chat summary.')
    }
  })
}
