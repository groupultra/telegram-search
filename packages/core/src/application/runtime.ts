import type { Logger } from '@guiiai/logg'
import type {
  AppResult,
  AuthUpdate,
  ChatRecord,
  CursorPage,
  ExportInput,
  ExportUpdate,
  ListChatsInput,
  ListRemoteMessagesInput,
  MessageContext,
  MessageContextInput,
  MessageRecord,
  QueryLocalMessagesInput,
  SearchMessageRecord,
  SearchMessagesInput,
  StatsInput,
  StatsResult,
  SubmitChallengeInput,
  SyncInput,
  SyncUpdate,
} from '@tg-search/protocol'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { EntityService } from '../services/entity'
import type { CoreDialog } from '../types/dialog'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'
import { v4 as uuidv4 } from 'uuid'

import { createJiebaResolver } from '../message-resolvers/jieba-resolver'
import { models as defaultModels } from '../models'
import { createEntityService } from '../services/entity'
import { createExportService } from '../services/export'
import { createLocalMessagesService } from '../services/local-messages'
import { createRemoteMessagesService } from '../services/remote-messages'
import { calculateStats } from '../services/stats'
import { convertToCoreMessage } from '../utils/message'
import { appResult } from './errors'

export interface TelegramApplication {
  listChats: (input: ListChatsInput) => Promise<AppResult<CursorPage<ChatRecord>>>
  listRemoteMessages: (input: ListRemoteMessagesInput) => Promise<AppResult<CursorPage<MessageRecord>>>
  queryLocalMessages: (input: QueryLocalMessagesInput) => Promise<AppResult<CursorPage<MessageRecord>>>
  searchLocalMessages: (input: SearchMessagesInput) => Promise<AppResult<CursorPage<SearchMessageRecord>>>
  getLocalMessageContext: (input: MessageContextInput) => Promise<AppResult<MessageContext>>
  getLocalStats: (input: StatsInput) => Promise<AppResult<StatsResult>>
  exportLocal: (input: ExportInput, signal?: AbortSignal) => AsyncGenerator<ExportUpdate>
  login: (input: { phoneNumber: string }, signal?: AbortSignal) => AsyncGenerator<AuthUpdate>
  submitAuthChallenge: (input: SubmitChallengeInput) => Promise<AppResult<{ accepted: true }>>
  sync: (input: SyncInput, signal?: AbortSignal) => AsyncGenerator<SyncUpdate>
}

export interface TelegramApplicationRuntime extends TelegramApplication {
  dispose: () => Promise<void>
}

export function createTelegramApplicationRuntime(options: {
  context: CoreContext
  logger?: Logger
  models?: Models
  entityService?: Pick<EntityService, 'getInputPeer'>
}): TelegramApplicationRuntime {
  const { context } = options
  const logger = options.logger ?? useLogger('application')
  const runtimeModels = options.models ?? defaultModels
  const entityService = options.entityService ?? createEntityService(context, logger)
  const jiebaResolver = createJiebaResolver(logger)
  const localMessages = createLocalMessagesService({
    accountId: context.getCurrentAccountId(),
    db: context.getDB(),
    logger,
    models: runtimeModels,
  })

  async function collectLocalMessages(input: { chatIds?: string[], from?: number, to?: number }): Promise<MessageRecord[]> {
    const messages: MessageRecord[] = []
    let cursor: string | undefined
    do {
      const page = await localMessages.query({ ...input, cursor, limit: 1000 })
      messages.push(...page.items)
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    return messages
  }

  function mapDialog(dialog: Dialog): { chat: ChatRecord, core: CoreDialog } | undefined {
    const entity = dialog.entity
    if (!(entity instanceof Api.User) && !(entity instanceof Api.Chat) && !(entity instanceof Api.Channel)) {
      return undefined
    }

    const isUser = entity instanceof Api.User
    const isBot = isUser && entity.bot === true
    const type: ChatRecord['type'] = isBot
      ? 'bot'
      : isUser
        ? 'user'
        : entity instanceof Api.Channel && entity.broadcast
          ? 'channel'
          : entity instanceof Api.Channel && entity.megagroup
            ? 'supergroup'
            : 'group'
    const name = isUser
      ? [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.username || String(entity.id)
      : entity.title
    const username = entity instanceof Api.User || entity instanceof Api.Channel
      ? entity.username
      : undefined
    const accessHash = entity instanceof Api.User || entity instanceof Api.Channel
      ? entity.accessHash?.toString()
      : undefined
    const lastMessageAt = dialog.message?.date

    return {
      chat: {
        id: String(entity.id),
        name,
        type,
        username,
        lastMessage: dialog.message?.message,
        lastMessageAt,
      },
      core: {
        id: entity.id.toJSNumber(),
        name,
        type,
        username,
        accessHash,
        isContact: isUser ? entity.contact : undefined,
        unreadCount: dialog.unreadCount,
        pinned: dialog.pinned,
        lastMessage: dialog.message?.message,
        lastMessageDate: lastMessageAt === undefined ? undefined : new Date(lastMessageAt * 1000),
      },
    }
  }

  function mapEntity(entity: Api.TypeUser | Api.TypeChat): CoreDialog | undefined {
    return mapDialog({ entity } as Dialog)?.core
  }

  async function fetchAndPersistDialogs(limit: number): Promise<ChatRecord[]> {
    const dialogs = await context.getClient().getDialogs({ limit })
    const mapped = dialogs.flatMap((dialog) => {
      const value = mapDialog(dialog)
      return value ? [value] : []
    })
    if (mapped.length > 0) {
      await runtimeModels.chatModels.recordChats(
        context.getDB(),
        mapped.map(value => value.core),
        context.getCurrentAccountId(),
      )
    }
    return mapped.map(value => value.chat)
  }

  async function resolveAndPersistPeer(chatId: string): Promise<Api.TypeInputPeer> {
    const peer = await entityService.getInputPeer(chatId)
    const coreDialog = mapEntity(await context.getClient().getEntity(peer))
    if (coreDialog) {
      await runtimeModels.chatModels.recordChats(
        context.getDB(),
        [coreDialog],
        context.getCurrentAccountId(),
      )
    }
    return peer
  }

  async function* sync(input: SyncInput, signal?: AbortSignal): AsyncGenerator<SyncUpdate> {
    const taskId = uuidv4()
    let processed = 0
    yield { type: 'started', taskId }

    const chatIds = input.all
      ? (await fetchAndPersistDialogs(1000)).map(chat => chat.id)
      : input.chatIds

    for (const chatId of chatIds) {
      if (signal?.aborted)
        return
      const peer = input.all
        ? await entityService.getInputPeer(chatId)
        : await resolveAndPersistPeer(chatId)
      const messages = await context.getClient().getMessages(peer, { limit: input.limit })
      const filteredMessages = messages
        .filter((message): message is Api.Message => message instanceof Api.Message)
        .filter(message => input.from === undefined || message.date >= input.from)
        .filter(message => input.to === undefined || message.date <= input.to)
      const coreMessages = filteredMessages.flatMap((message) => {
        const coreMessage = convertToCoreMessage(message).orUndefined()
        return coreMessage ? [coreMessage] : []
      })
      const tokenizedMessages = jiebaResolver.run
        ? (await jiebaResolver.run({ messages: coreMessages, rawMessages: filteredMessages })).orUndefined() ?? coreMessages
        : coreMessages
      await runtimeModels.chatMessageModels.recordMessages(context.getDB(), context.getCurrentAccountId(), tokenizedMessages)
      processed += tokenizedMessages.length
      const lastMessage = tokenizedMessages.at(-1)
      if (lastMessage) {
        yield { type: 'checkpoint', taskId, chatId, messageId: lastMessage.platformMessageId }
      }
      yield { type: 'progress', taskId, processed }
    }

    yield { type: 'completed', taskId, processed }
  }

  return {
    listChats: input => appResult(async () => {
      const offset = Number.parseInt(input.cursor ?? '0', 10) || 0
      const items = (await fetchAndPersistDialogs(offset + input.limit + 1))
        .filter(chat => !input.types?.length || input.types.includes(chat.type))
      return {
        items: items.slice(offset, offset + input.limit),
        nextCursor: items.length > offset + input.limit ? String(offset + input.limit) : null,
      }
    }),
    listRemoteMessages: input => appResult(() => createRemoteMessagesService(context.getClient(), entityService.getInputPeer)(input)),
    queryLocalMessages: input => appResult(() => localMessages.query(input)),
    searchLocalMessages: input => appResult(() => localMessages.search(input)),
    getLocalMessageContext: input => appResult(() => localMessages.context(input)),
    getLocalStats: input => appResult(async () => calculateStats(await collectLocalMessages(input), input)),
    exportLocal: (input, signal) => createExportService(cursor => localMessages.query({
      chatIds: input.chatIds,
      from: input.from,
      to: input.to,
      cursor,
      limit: 1000,
    }))(input, signal),
    async* login() {
      const flowId = uuidv4()
      yield { type: 'failed', flowId, error: { code: 'NOT_CONFIGURED', message: 'Login runtime is not configured', retryable: false } }
    },
    submitAuthChallenge: async () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'Authentication flow not found', retryable: false } }),
    sync,
    dispose: async () => {},
  }
}
