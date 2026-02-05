import type { Logger } from '@guiiai/logg'
import type { CoreDB, Models } from '@tg-search/core'
import type { Bot } from 'grammy'

import { registerSearchCommand } from './search'
import { registerStartCommand } from './start'
import { registerSummaryCommand } from './summary'

export interface BotCommandContext {
  getDB: () => CoreDB
  models: Models
  resolveAccountByTelegramUserId: (userId: number) => Promise<{ id: string, platform_user_id: string } | undefined>
  logger: Logger
}

export function registerCommands(bot: Bot, ctx: BotCommandContext) {
  registerStartCommand(bot, ctx)
  registerSearchCommand(bot, ctx)
  registerSummaryCommand(bot, ctx)

  // Catch unhandled messages
  bot.on('message:text', async (gramCtx) => {
    const text = gramCtx.message.text
    if (!text.startsWith('/')) {
      await gramCtx.reply('Send /search <query> to search your messages, or /summary to get a chat summary.')
    }
  })
}
