import type { Logger } from '@guiiai/logg'
import type {
  AppError,
  AppResult,
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
  SyncInput,
  SyncUpdate,
} from '@tg-search/protocol'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { EntityService } from '../services/entity'
import type { TakeoutService } from '../services/takeout'
import type { CoreDialog } from '../types/dialog'
import type { ReadOperationOptions, ReadOperationScope } from './read-operation'

import { useLogger } from '@guiiai/logg'
import { isBrowser } from '@tg-search/common'
import { Api } from 'telegram'
import { v4 as uuidv4 } from 'uuid'

import { createJiebaResolver } from '../message-resolvers/jieba-resolver'
import { models as defaultModels } from '../models'
import { createEntityService } from '../services/entity'
import { createLocalMessagesService } from '../services/local-messages'
import { createRemoteMessagesService } from '../services/remote-messages'
import { createStatsAccumulator } from '../services/stats'
import { createTakeoutService } from '../services/takeout'
import { convertToCoreMessage } from '../utils/message'
import { createTask } from '../utils/task'
import { appResult, toAppError } from './errors'
import { withReadOperation } from './read-operation'

function takeoutFailure(error: unknown, message: string): AppError {
  const classified = toAppError(error)
  if (classified.code !== 'INTERNAL')
    return classified
  return { code: 'TAKEOUT_FAILED', message, retryable: false }
}

export interface TelegramApplication {
  listChats: (input: ListChatsInput, options?: ReadOperationOptions) => Promise<AppResult<CursorPage<ChatRecord>>>
  listRemoteMessages: (input: ListRemoteMessagesInput, options?: ReadOperationOptions) => Promise<AppResult<CursorPage<MessageRecord>>>
  queryLocalMessages: (input: QueryLocalMessagesInput, options?: ReadOperationOptions) => Promise<AppResult<CursorPage<MessageRecord>>>
  searchLocalMessages: (input: SearchMessagesInput, options?: ReadOperationOptions) => Promise<AppResult<CursorPage<SearchMessageRecord>>>
  getLocalMessageContext: (input: MessageContextInput, options?: ReadOperationOptions) => Promise<AppResult<MessageContext>>
  getLocalStats: (input: StatsInput, options?: ReadOperationOptions) => Promise<AppResult<StatsResult>>
  exportLocal?: (input: ExportInput, signal?: AbortSignal) => AsyncGenerator<ExportUpdate>
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
  takeoutService?: Pick<TakeoutService, 'takeoutMessages'>
  retryTelegramRead?: <T>(operation: () => Promise<T>) => Promise<T>
}): TelegramApplicationRuntime {
  const { context } = options
  const logger = options.logger ?? useLogger('application')
  const runtimeModels = options.models ?? defaultModels
  const entityService = options.entityService ?? createEntityService(context, logger)
  const takeoutService = options.takeoutService ?? createTakeoutService(
    context,
    logger,
    runtimeModels.chatModels,
    runtimeModels.chatMessageStatsModels,
    entityService,
    { retryTelegramRead: options.retryTelegramRead },
  )
  const jiebaResolver = createJiebaResolver(logger)
  const localMessages = createLocalMessagesService({
    db: context.getDB(),
    getAccountId: context.getCurrentAccountId,
    logger,
    models: runtimeModels,
  })

  async function calculateLocalStats(input: StatsInput, scope: ReadOperationScope): Promise<StatsResult> {
    const accumulator = createStatsAccumulator(input)
    let cursor: string | undefined
    do {
      scope.throwIfAborted()
      const page = await scope.wait(localMessages.query({ ...input, cursor, limit: 1000 }))
      accumulator.add(page.items)
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    return accumulator.result()
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

  async function fetchAndPersistDialogs(limit?: number, scope?: ReadOperationScope): Promise<ChatRecord[]> {
    const client = context.getClient()
    const parameters = limit === undefined ? {} : { limit }
    let dialogs: Dialog[]
    if (scope) {
      dialogs = []
      // Own the public iterator so a cancelled read cannot collect more SDK pages.
      // The current next() RPC still has the documented GramJS cancellation limit.
      const iterator = client.iterDialogs(parameters)[Symbol.asyncIterator]()
      while (true) {
        scope.throwIfAborted()
        const item = await scope.telegram(client, () => iterator.next())
        if (item.done)
          break
        dialogs.push(item.value)
      }
    }
    else {
      dialogs = await client.getDialogs(parameters)
    }
    const mapped = dialogs.flatMap((dialog) => {
      const value = mapDialog(dialog)
      return value ? [value] : []
    })
    scope?.throwIfAborted()
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

    if (!input.takeout) {
      yield {
        type: 'failed',
        taskId,
        error: {
          code: 'TAKEOUT_CONSENT_REQUIRED',
          message: 'Bulk sync requires explicit Telegram Takeout consent',
          retryable: false,
        },
      }
      return
    }

    yield { type: 'started', taskId }

    try {
      const chatIds = input.all
        ? (await fetchAndPersistDialogs()).map(chat => chat.id)
        : input.chatIds

      for (const chatId of chatIds) {
        if (signal?.aborted)
          return
        if (input.all)
          await entityService.getInputPeer(chatId)
        else
          await resolveAndPersistPeer(chatId)

        const takeoutTask = createTask('takeout', { chatIds: [chatId], totalMessages: input.limit }, context.emitter, logger)
        const abortTakeout = () => takeoutTask.abort()
        signal?.addEventListener('abort', abortTakeout, { once: true })

        let rawBatch: Api.Message[] = []
        const persistBatch = async (batch: Api.Message[]) => {
          const coreMessages = batch.flatMap((rawMessage) => {
            const coreMessage = convertToCoreMessage(rawMessage).orUndefined()
            return coreMessage ? [coreMessage] : []
          })
          const tokenizedMessages = jiebaResolver.run
            ? (await jiebaResolver.run({ messages: coreMessages, rawMessages: batch })).orUndefined() ?? coreMessages
            : coreMessages
          await runtimeModels.chatMessageModels.recordMessages(
            context.getDB(),
            context.getCurrentAccountId(),
            tokenizedMessages,
          )
          processed += tokenizedMessages.length
          return tokenizedMessages.at(-1)
        }

        try {
          for await (const message of takeoutService.takeoutMessages(chatId, {
            pagination: { limit: 100, offset: 0 },
            startTime: input.from === undefined ? undefined : input.from * 1000,
            endTime: input.to === undefined ? undefined : input.to * 1000,
            skipMedia: true,
            maxMessages: input.limit,
            expectedCount: input.limit,
            disableAutoProgress: true,
            takeoutConsent: true,
            task: takeoutTask,
          })) {
            rawBatch.push(message)
            if (rawBatch.length < 100)
              continue

            const lastMessage = await persistBatch(rawBatch)
            if (lastMessage)
              yield { type: 'checkpoint', taskId, chatId, messageId: lastMessage.platformMessageId }
            yield { type: 'progress', taskId, processed }
            rawBatch = []
          }

          if (rawBatch.length > 0) {
            const lastMessage = await persistBatch(rawBatch)
            if (lastMessage)
              yield { type: 'checkpoint', taskId, chatId, messageId: lastMessage.platformMessageId }
            yield { type: 'progress', taskId, processed }
          }
        }
        finally {
          signal?.removeEventListener('abort', abortTakeout)
        }

        if (takeoutTask.state.lastError) {
          yield {
            type: 'failed',
            taskId,
            error: takeoutFailure(takeoutTask.state.rawError, takeoutTask.state.lastError),
          }
          return
        }
      }
    }
    catch (error) {
      yield { type: 'failed', taskId, error: toAppError(error) }
      return
    }

    yield { type: 'completed', taskId, processed }
  }

  // NOTICE: Lazy-import export.ts so Vite's browser bundle never evaluates its node:crypto/fs
  // deps. Browser runtimes omit exportLocal entirely (see TelegramApplication['exportLocal']).
  async function* exportLocal(input: ExportInput, signal?: AbortSignal): AsyncGenerator<ExportUpdate> {
    const { createExportService } = await import('../services/export')
    yield* createExportService(cursor => localMessages.queryForExport({
      chatIds: input.chatIds,
      from: input.from,
      to: input.to,
      cursor,
      limit: 1000,
    }))(input, signal)
  }

  return {
    listChats: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, async (scope) => {
      const offset = Number.parseInt(input.cursor ?? '0', 10) || 0
      const items = (await fetchAndPersistDialogs(offset + input.limit + 1, scope))
        .filter(chat => !input.types?.length || input.types.includes(chat.type))
      return {
        items: items.slice(offset, offset + input.limit),
        nextCursor: items.length > offset + input.limit ? String(offset + input.limit) : null,
      }
    })),
    listRemoteMessages: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, scope => createRemoteMessagesService(context.getClient(), entityService.getInputPeer)(input, scope))),
    queryLocalMessages: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, scope => scope.wait(localMessages.query(input)))),
    searchLocalMessages: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, scope => scope.wait(localMessages.search(input)))),
    getLocalMessageContext: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, scope => scope.wait(localMessages.context(input)))),
    getLocalStats: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, scope => calculateLocalStats(input, scope))),
    exportLocal: isBrowser() ? undefined : exportLocal,
    sync,
    dispose: async () => {},
  }
}
