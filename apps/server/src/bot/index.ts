import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { CoreDB } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { models } from '@tg-search/core'
import { Bot } from 'grammy'

import { registerCommands } from './commands'
import { createScheduler } from './scheduler'

export interface BotManager {
  start: () => Promise<void>
  stop: () => Promise<void>
  sendMessage: (chatId: string | number, text: string, parseMode?: 'HTML' | 'MarkdownV2') => Promise<void>
  getBot: () => Bot | undefined
}

export function createBotManager(
  config: Config,
  getDB: () => CoreDB,
  logger?: Logger,
): BotManager {
  logger = (logger ?? useLogger()).withContext('server:bot')

  const token = config.api.telegram.botToken
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN not set, bot features disabled')
    return createNullBotManager()
  }

  const bot = new Bot(token)
  const scheduler = createScheduler(getDB, bot, logger)

  async function resolveAccountByTelegramUserId(userId: number) {
    const db = getDB()
    const result = await models.accountModels.findAccountByPlatformId(db, 'telegram', String(userId))
    return result.unwrap()
  }

  registerCommands(bot, {
    getDB,
    models,
    resolveAccountByTelegramUserId,
    logger,
  })

  return {
    async start() {
      logger.log('Starting Grammy bot...')

      // Load scheduled tasks from DB
      await scheduler.loadTasks()

      // Start long-polling (non-blocking)
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

function createNullBotManager(): BotManager {
  return {
    async start() {},
    async stop() {},
    async sendMessage() {},
    getBot() {
      return undefined
    },
  }
}

// Module-level singleton for access from account.ts
let _botManager: BotManager | undefined

export function setBotManagerInstance(manager: BotManager) {
  _botManager = manager
}

export function getBotManager(): BotManager | undefined {
  return _botManager
}
