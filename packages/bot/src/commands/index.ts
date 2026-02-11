import type { Logger } from '@guiiai/logg'
import type { CoreContext, CoreDB, Models } from '@tg-search/core'
import type { Bot } from 'grammy'

import { registerContextCallbacks } from './context'
import { registerExportCommand } from './export'
import { registerInlineQueryHandler } from './inline'
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
  getAccountContext: (accountId: string) => CoreContext | undefined
  logger: Logger
}

export function registerCommands(bot: Bot, ctx: BotCommandContext) {
  registerStartCommand(bot, ctx)
  registerSearchCommand(bot, ctx)
  registerSummaryCommand(bot, ctx)
  registerExportCommand(bot, ctx)
  registerInlineQueryHandler(bot, ctx)
  registerContextCallbacks(bot, ctx)
}
