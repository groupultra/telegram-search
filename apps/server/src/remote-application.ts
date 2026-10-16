import type { CoreDB, ReadOperationOptions, TelegramApplication } from '@tg-search/core'
import type { ListChatsInput, ListChatsResult } from '@tg-search/protocol'

import { useLogger } from '@guiiai/logg'
import { appResult, createCoreContext, createTelegramApplicationRuntime, models, withReadOperation } from '@tg-search/core'

import { accountStates } from './account'

export interface RemoteApplication extends TelegramApplication {
  listStoredChats: (input: ListChatsInput, chatIds: string[], options?: ReadOperationOptions) => Promise<ListChatsResult>
}

export function createRemoteApplication(db: CoreDB, accountId: string): RemoteApplication {
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
    listChats: (input, options) => connected()?.listChats(input, options) ?? Promise.resolve(unavailable),
    listStoredChats: (input, chatIds, options) => appResult(() => withReadOperation(options, async (scope) => {
      const offset = Number.parseInt(input.cursor ?? '0', 10) || 0
      const rows = (await scope.wait(models.chatModels.fetchAccountChatsPage(db, accountId, chatIds, input.types, offset, input.limit + 1)))
        .expect('Failed to list stored account chats')
      const items = rows.slice(0, input.limit).map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        username: row.username ?? undefined,
        lastMessage: row.lastMessage ?? undefined,
        lastMessageAt: row.lastMessageAt || undefined,
      }))
      return { items, nextCursor: rows.length > input.limit ? String(offset + input.limit) : null }
    })),
    getMessages: (input, options) => input.source === 'local' ? stored.getMessages(input, options) : connected()?.getMessages(input, options) ?? Promise.resolve(unavailable),
    listRemoteMessages: (input, options) => connected()?.listRemoteMessages(input, options) ?? Promise.resolve(unavailable),
    getReplyContext: (input, readOptions) => input.source === 'local' ? stored.getReplyContext(input, readOptions) : connected()?.getReplyContext(input, readOptions) ?? Promise.resolve(unavailable),
    readMessages: (input, readOptions) => input.source === 'local' ? stored.readMessages(input, readOptions) : connected()?.readMessages(input, readOptions) ?? Promise.resolve(unavailable),
  }
}
