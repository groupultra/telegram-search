import type { CoreDB, TelegramApplication } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { createCoreContext, createTelegramApplicationRuntime, models } from '@tg-search/core'

import { accountStates } from './account'

export function createRemoteApplication(db: CoreDB, accountId: string): TelegramApplication {
  const logger = useLogger('server:remote')
  const context = createCoreContext(() => db, models, logger)
  context.setCurrentAccountId(accountId)
  const stored = createTelegramApplicationRuntime({ context, logger })

  function connected() {
    const account = [...accountStates.values()].find(account => account.accountReady && account.ctx.getCurrentAccountId() === accountId)
    return account ? createTelegramApplicationRuntime({ context: account.ctx, logger }) : undefined
  }

  const unavailable = { ok: false as const, error: { code: 'TELEGRAM_NOT_CONNECTED', message: 'Sign in to Telegram on the server to read live messages; indexed queries remain available', retryable: false } }
  return {
    ...stored,
    listChats: input => connected()?.listChats(input) ?? Promise.resolve(unavailable),
    listRemoteMessages: input => connected()?.listRemoteMessages(input) ?? Promise.resolve(unavailable),
  }
}
