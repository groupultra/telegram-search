import type { CoreDB, ReadOperationOptions, TelegramApplication } from '@tg-search/core'
import type { ListChatsInput, ListChatsResult } from '@tg-search/protocol'

import { useLogger } from '@guiiai/logg'
import { appResult, createCoreContext, createTelegramApplicationRuntime, models, withReadOperation } from '@tg-search/core'

import { accountStates } from './account'
import { getMediaStorage } from './storage/media'

export interface RemoteApplication extends TelegramApplication {
  listStoredChats: (input: ListChatsInput, chatIds: string[], options?: ReadOperationOptions) => Promise<ListChatsResult>
}

export function createRemoteApplication(db: CoreDB, accountId: string): RemoteApplication {
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
    inspectMessageMedia: (input, options) => input.source === 'local'
      ? stored.inspectMessageMedia(input, options)
      : connected()?.inspectMessageMedia(input, options) ?? Promise.resolve(unavailable),
    downloadMessageMedia: (input, options) => input.source === 'local'
      ? stored.downloadMessageMedia(input, options)
      : connected()?.downloadMessageMedia(input, options) ?? Promise.resolve(unavailable),
    readMessageMedia: (input, options) => input.source === 'local'
      ? stored.readMessageMedia(input, options)
      : connected()?.readMessageMedia(input, options) ?? Promise.resolve(unavailable),
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
    getMessages: (input, options) => input.source === 'local'
      ? stored.getMessages(input, options)
      : connected()?.getMessages(input, options) ?? Promise.resolve(unavailable),
    listRemoteMessages: (input, options) => connected()?.listRemoteMessages(input, options) ?? Promise.resolve(unavailable),
    getReplyContext: (input, options) => input.source === 'local'
      ? stored.getReplyContext(input, options)
      : connected()?.getReplyContext(input, options) ?? Promise.resolve(unavailable),
    readMessages: (input, options) => input.source === 'local'
      ? stored.readMessages(input, options)
      : connected()?.readMessages(input, options) ?? Promise.resolve(unavailable),
  }
}
