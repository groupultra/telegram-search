import type { CoreDB, TelegramApplication } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { createCoreContext, createTelegramApplicationRuntime, models } from '@tg-search/core'

import { accountStates } from './account'
import { getMediaStorage } from './storage/media'

export function createRemoteApplication(db: CoreDB, accountId: string): TelegramApplication {
  const logger = useLogger('server:remote')
  const context = createCoreContext(() => db, models, logger)
  context.setCurrentAccountId(accountId)
  const stored = createTelegramApplicationRuntime({ context, logger, mediaBinaryProvider: getMediaStorage() })

  function connected() {
    const account = [...accountStates.values()].find(account => account.accountReady && account.ctx.getCurrentAccountId() === accountId)
    return account ? createTelegramApplicationRuntime({ context: account.ctx, logger, mediaBinaryProvider: getMediaStorage() }) : undefined
  }

  const unavailable = { ok: false as const, error: { code: 'TELEGRAM_NOT_CONNECTED', message: 'Sign in to Telegram on the server to read live messages; indexed queries remain available', retryable: false } }
  return {
    ...stored,
    readMessageMedia: (input, options) => input.source === 'local'
      ? stored.readMessageMedia(input, options)
      : connected()?.readMessageMedia(input, options) ?? Promise.resolve(unavailable),
    listChats: (input, options) => connected()?.listChats(input, options) ?? Promise.resolve(unavailable),
    getMessages: (input, options) => input.source === 'local' ? stored.getMessages(input, options) : connected()?.getMessages(input, options) ?? Promise.resolve(unavailable),
    listRemoteMessages: (input, options) => connected()?.listRemoteMessages(input, options) ?? Promise.resolve(unavailable),
    getReplyContext: (input, readOptions) => input.source === 'local' ? stored.getReplyContext(input, readOptions) : connected()?.getReplyContext(input, readOptions) ?? Promise.resolve(unavailable),
    readMessages: (input, readOptions) => input.source === 'local' ? stored.readMessages(input, readOptions) : connected()?.readMessages(input, readOptions) ?? Promise.resolve(unavailable),
  }
}
