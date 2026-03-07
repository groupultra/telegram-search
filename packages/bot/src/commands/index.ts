import type { Logger } from '@guiiai/logg'
import type { CoreContext, CoreDB, Models } from '@tg-search/core'
import type { Bot } from 'grammy'

import { registerContextCallbacks } from './context'
import { registerExportCommand } from './export'
import { registerInlineQueryHandler } from './inline'
import { registerLoginCommand } from './login'
import { registerLogoutCommand } from './logout'
import { registerSearchCommand } from './search'
import { registerStartCommand } from './start'
import { registerStatusCommand } from './status'
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
  /**
   * Ensure an account context exists for the given account ID.
   * Creates a new CoreContext if one does not exist yet.
   * Used by the login flow to bootstrap a context before auth.
   */
  ensureAccountContext: (accountId: string) => CoreContext
  logger: Logger
}

export function registerCommands(bot: Bot, ctx: BotCommandContext) {
  // Login command must be registered first so its text handler
  // can intercept phone/code/password messages before other handlers.
  registerLoginCommand(bot, ctx)
  registerStartCommand(bot, ctx)
  registerSearchCommand(bot, ctx)
  registerSummaryCommand(bot, ctx)
  registerExportCommand(bot, ctx)
  registerLogoutCommand(bot, ctx)
  registerStatusCommand(bot, ctx)
  registerInlineQueryHandler(bot, ctx)
  registerContextCallbacks(bot, ctx)
}
