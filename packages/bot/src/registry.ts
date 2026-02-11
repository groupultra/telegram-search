import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { CoreContext, CoreDB } from '@tg-search/core'
import type { Bot } from 'grammy'

import type { BotCommandAccount } from './commands'

import { useLogger } from '@guiiai/logg'
import { models } from '@tg-search/core'
import { Bot as GrammyBot } from 'grammy'

import { registerCommands } from './commands'
import { createScheduler } from './scheduler'

export type BotParseMode = 'HTML' | 'MarkdownV2'

export interface BotRegistry {
  start: () => Promise<void>
  stop: () => Promise<void>
  sendMessage: (chatId: string | number, text: string, parseMode?: BotParseMode) => Promise<void>
  getBot: () => Bot | undefined
}

export interface BotRegistryOptions {
  config: Config
  getDB: () => CoreDB
  getAccountContext: (accountId: string) => CoreContext | undefined
  logger?: Logger
}

export function createBotRegistry(options: BotRegistryOptions): BotRegistry {
  const logger = (options.logger ?? useLogger()).withContext('server:bot')

  const token = options.config.api.telegram.botToken
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN not set, bot features disabled')
    return createNullBotRegistry()
  }

  const bot = new GrammyBot(token)
  const scheduler = createScheduler(options.getDB, bot, logger)

  const resolveAccountByTelegramUserId = async (userId: number): Promise<BotCommandAccount | undefined> => {
    const db = options.getDB()
    const result = await models.accountModels.findAccountByPlatformId(db, 'telegram', String(userId))
    const account = result.orUndefined()
    if (!account) {
      return undefined
    }

    return {
      id: account.id,
      platformUserId: account.platform_user_id,
    }
  }

  registerCommands(bot, {
    getDB: options.getDB,
    models,
    resolveAccountByTelegramUserId,
    getAccountContext: options.getAccountContext,
    logger,
  })

  return {
    async start() {
      logger.log('Starting Grammy bot...')

      // Set bot commands for autocomplete in chat input
      await bot.api.setMyCommands([
        { command: 'start', description: 'Start the bot and show welcome message' },
        { command: 'search', description: 'Search messages in your chats' },
        { command: 'summary', description: 'Generate AI summary of recent messages' },
        { command: 'export', description: 'Export or sync messages from Telegram' },
      ])

      await scheduler.loadTasks()

      bot.start({
        onStart: (info) => {
          logger.withFields({ username: info.username }).log('Bot started')
        },
      })
    },

    async stop() {
      logger.log('Stopping Grammy bot...')
      scheduler.stopAll()
      await bot.stop()
      logger.log('Bot stopped')
    },

    async sendMessage(chatId, text, parseMode) {
      await bot.api.sendMessage(chatId, text, {
        parse_mode: parseMode,
      })
    },

    getBot() {
      return bot
    },
  }
}

function createNullBotRegistry(): BotRegistry {
  return {
    async start() {},
    async stop() {},
    async sendMessage() {},
    getBot() {
      return undefined
    },
  }
}

let _botRegistry: BotRegistry | undefined

export function setBotRegistryInstance(registry: BotRegistry) {
  _botRegistry = registry
}

export function getBotRegistry(): BotRegistry | undefined {
  return _botRegistry
}
