import type { Logger } from '@guiiai/logg'
import type { TelegramClient } from 'telegram'

import type { ProfilePaths } from './profile'

import process from 'node:process'

import { createHash } from 'node:crypto'

import { LogLevel, setGlobalLogLevel } from '@guiiai/logg'
import { createContext, defineInvokes, defineStreamInvoke } from '@moeru/eventa'
import { generateDefaultConfig } from '@tg-search/common'
import {
  createCoreContext,
  createTelegramApplicationRuntime,
  initDrizzle,
  models,
  registerApplicationHandlers,
} from '@tg-search/core'
import {
  chatContracts,
  exportContracts,
  messageContracts,
  statsContracts,
  syncContracts,
} from '@tg-search/protocol'
import { TelegramClient as GramJsClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

import { closeOwnedTelegramClient } from './auth-support'
import { createGramJsStderrLogger } from './gramjs-logger'
import { readProfileConfig, readSession, writeProfileConfig } from './profile'

function createSilentLogger(): Logger {
  const logger: Record<string, unknown> = {}
  const chain = () => logger
  for (const method of ['withContext', 'withFields', 'withError', 'withLogLevel', 'withLogLevelString', 'useGlobalConfig'])
    logger[method] = chain
  for (const method of ['debug', 'verbose', 'log', 'warn', 'error'])
    logger[method] = () => {}
  return logger as unknown as Logger
}

async function withStdoutRedirectedToStderr<T>(operation: () => Promise<T>): Promise<T> {
  const originalWrite = process.stdout.write.bind(process.stdout)
  process.stdout.write = ((...args: Parameters<typeof process.stdout.write>) => {
    return process.stderr.write(...args)
  }) as typeof process.stdout.write
  try {
    return await operation()
  }
  finally {
    process.stdout.write = originalWrite as typeof process.stdout.write
  }
}

export function profileScopeId(profileRoot: string): string {
  const digest = createHash('sha256').update(profileRoot).digest('hex')
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`
}

export async function createCliRuntime(paths: ProfilePaths, options: { remote: boolean }) {
  setGlobalLogLevel(LogLevel.Error)
  const logger = createSilentLogger()
  const profileConfig = await readProfileConfig(paths)
  const config = generateDefaultConfig()
  config.api.telegram.apiId = profileConfig.apiId ?? process.env.TELEGRAM_API_ID
  config.api.telegram.apiHash = profileConfig.apiHash ?? process.env.TELEGRAM_API_HASH

  const { db, pglite } = await withStdoutRedirectedToStderr(
    () => initDrizzle(logger, config, { dbPath: paths.database }),
  )
  // A pre-login local runtime still needs a UUID-shaped owner scope for SQL
  // comparisons, but it must not create a fake account row that will be
  // orphaned after Telegram resolves the real account.
  let accountId = profileConfig.accountId ?? profileScopeId(paths.root)

  const context = createCoreContext(() => db, models, logger)
  context.setCurrentAccountId(accountId)
  let client: TelegramClient | undefined

  if (options.remote) {
    if (!config.api.telegram.apiId || !config.api.telegram.apiHash) {
      throw new Error('Telegram API credentials are missing; run profile configure or set TELEGRAM_API_ID and TELEGRAM_API_HASH')
    }
    const session = await readSession(paths)
    if (!session) {
      throw new Error('Telegram session is missing; run auth login first')
    }
    client = new GramJsClient(
      new StringSession(session),
      Number(config.api.telegram.apiId),
      config.api.telegram.apiHash,
      { connectionRetries: 3, baseLogger: createGramJsStderrLogger() },
    )
    await client.connect()
    if (!await client.isUserAuthorized()) {
      throw new Error('Telegram session is no longer authorized; run auth login again')
    }
    const me = await client.getMe()
    const account = await models.accountModels.recordAccount(db, 'telegram', String(me.id))
    accountId = account.id
    context.setCurrentAccountId(accountId)
    context.setClient(client)
    context.setMyUser({
      id: String(me.id),
      name: [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username || String(me.id),
      username: me.username ?? String(me.id),
      accessHash: me.accessHash?.toString(),
      type: 'user',
    })
    if (profileConfig.accountId !== accountId) {
      await writeProfileConfig(paths, { ...profileConfig, accountId })
    }
  }

  const application = createTelegramApplicationRuntime({ context, logger, models })
  const eventContext = createContext()
  const unregister = registerApplicationHandlers(eventContext, application)

  return {
    invokes: {
      chats: defineInvokes(eventContext, chatContracts),
      messages: defineInvokes(eventContext, messageContracts),
      stats: defineInvokes(eventContext, statsContracts),
    },
    streams: {
      sync: defineStreamInvoke(eventContext, syncContracts.run),
      export: defineStreamInvoke(eventContext, exportContracts.run),
    },
    close: async () => {
      unregister()
      eventContext.abort()
      await application.dispose()
      context.cleanup()
      if (client)
        await closeOwnedTelegramClient(client)
      await pglite?.close()
    },
  }
}
