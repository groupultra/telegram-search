import type { Logger } from '@guiiai/logg'
import type {
  AppResult,
  ChatRecord,
  CursorPage,
  ListChatsInput,
  ListRemoteMessagesInput,
  MessageContext,
  MessageContextInput,
  MessageRecord,
  QueryLocalMessagesInput,
  SearchMessageRecord,
  SearchMessagesInput,
} from '@tg-search/protocol'

import type { CoreContext } from '../context'
import type { Models } from '../models'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'

import { models as defaultModels } from '../models'
import { createLocalMessagesService } from '../services/local-messages'
import { createRemoteMessagesService } from '../services/remote-messages'
import { appResult } from './errors'

export interface TelegramApplication {
  listChats: (input: ListChatsInput) => Promise<AppResult<CursorPage<ChatRecord>>>
  listRemoteMessages: (input: ListRemoteMessagesInput) => Promise<AppResult<CursorPage<MessageRecord>>>
  queryLocalMessages: (input: QueryLocalMessagesInput) => Promise<AppResult<CursorPage<MessageRecord>>>
  searchLocalMessages: (input: SearchMessagesInput) => Promise<AppResult<CursorPage<SearchMessageRecord>>>
  getLocalMessageContext: (input: MessageContextInput) => Promise<AppResult<MessageContext>>
  getLocalStats: (input: unknown) => Promise<AppResult<unknown>>
}

export interface TelegramApplicationRuntime extends TelegramApplication {
  dispose: () => Promise<void>
}

export function createTelegramApplicationRuntime(options: {
  context: CoreContext
  logger?: Logger
  models?: Models
}): TelegramApplicationRuntime {
  const { context } = options
  const logger = options.logger ?? useLogger('application')
  const runtimeModels = options.models ?? defaultModels
  const remoteMessages = createRemoteMessagesService(context.getClient())
  const localMessages = createLocalMessagesService({
    accountId: context.getCurrentAccountId(),
    db: context.getDB(),
    logger,
    models: runtimeModels,
  })

  return {
    listChats: input => appResult(async () => {
      const offset = Number.parseInt(input.cursor ?? '0', 10) || 0
      const dialogs = await context.getClient().getDialogs({ limit: input.limit + 1, offsetDate: 0 })
      const items: ChatRecord[] = dialogs
        .flatMap((dialog) => {
          const entity = dialog.entity
          if (!(entity instanceof Api.User) && !(entity instanceof Api.Chat) && !(entity instanceof Api.Channel)) {
            return []
          }
          const isUser = entity instanceof Api.User
          const isBot = isUser && entity.bot === true
          const type: ChatRecord['type'] = isBot
            ? 'bot'
            : isUser
              ? 'user'
              : 'broadcast' in entity && entity.broadcast
                ? 'channel'
                : 'megagroup' in entity && entity.megagroup
                  ? 'supergroup'
                  : 'group'
          const name = isUser
            ? [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.username || String(entity.id)
            : entity.title
          return [{
            id: String(entity.id),
            name,
            type,
            username: 'username' in entity ? entity.username : undefined,
            lastMessage: dialog.message?.message,
            lastMessageAt: dialog.message?.date,
          }]
        })
        .filter(chat => !input.types?.length || input.types.includes(chat.type))
      return {
        items: items.slice(offset, offset + input.limit),
        nextCursor: items.length > offset + input.limit ? String(offset + input.limit) : null,
      }
    }),
    listRemoteMessages: input => appResult(() => remoteMessages(input)),
    queryLocalMessages: input => appResult(() => localMessages.query(input)),
    searchLocalMessages: input => appResult(() => localMessages.search(input)),
    getLocalMessageContext: input => appResult(() => localMessages.context(input)),
    getLocalStats: async () => ({ ok: true, data: {} }),
    dispose: async () => {},
  }
}
