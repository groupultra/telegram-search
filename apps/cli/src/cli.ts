import type { TelegramAdapter } from '@tg-search/core'

import process from 'node:process'
import { getConfig, initDB, useLogger } from '@tg-search/common'
import { createAdapter } from '@tg-search/core'
import { Command as Commander } from 'commander'

import { registry } from './command'
import embedCommand from './commands/embed'
import exportCommand from './commands/export'
import importCommand from './commands/import'
import searchCommand from './commands/search'
import syncCommand from './commands/sync'
import watchCommand from './commands/watch'
import { ensureAuthenticated } from './middlewares/connect'

const logger = useLogger()

/**
 * Register all commands
 */
export function registerCommands() {
  registry.register(embedCommand)
  registry.register(exportCommand)
  registry.register(importCommand)
  registry.register(searchCommand)
  registry.register(syncCommand)
  registry.register(watchCommand)
}

/**
 * Setup command line interface
 */
export function setupCli() {
  const program = new Commander()

  // Setup global options
  program
    .name('tg-search')
    .version('1.0.0')
    .description('Telegram Search CLI')
    .option('-d, --debug', 'Enable debug mode')

  // Register commands
  for (const command of registry.getAll()) {
    const cmd = program
      .command(command.meta.name)
      .description(command.meta.description)

    if (command.meta.usage) {
      cmd.usage(command.meta.usage)
    }

    // Add command options
    if (command.meta.options) {
      for (const option of command.meta.options) {
        cmd.option(option.flags, option.description)
      }
    }

    // Execute command
    cmd.action(async (options) => {
      let client: TelegramAdapter | undefined

      try {
        // Initialize database
        logger.debug('正在初始化数据库...')
        initDB()
        logger.debug('数据库初始化完成')

        // Initialize Telegram client if needed
        if (command.meta.requiresConnection) {
          const config = getConfig()
          client = await createAdapter({
            type: 'client',
            apiId: Number(config.api.telegram.apiId),
            apiHash: config.api.telegram.apiHash,
            phoneNumber: config.api.telegram.phoneNumber,
          })

          // Set client for command
          if ('setClient' in command) {
            (command as { setClient: (client: TelegramAdapter) => void }).setClient(client)
          }

          // Ensure authentication before executing command
          await ensureAuthenticated(client)
        }

        // Execute command
        await command.execute(cmd.args, options)
      }
      catch (error) {
        logger.withError(error).error('命令执行失败')
        process.exit(1)
      }
      finally {
        // Disconnect client if exists
        if (client) {
          logger.debug('正在断开连接...')
          await client.disconnect()
          logger.debug('连接已断开')
        }
        process.exit(0)
      }
    })
  }

  // Show help by default
  program.showHelpAfterError()
  program.showSuggestionAfterError()

  return program
}
