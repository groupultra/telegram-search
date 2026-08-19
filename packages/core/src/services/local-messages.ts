import type { Logger } from '@guiiai/logg'
import type {
  CursorPage,
  ExportMessageRecord,
  MessageContext,
  MessageContextInput,
  MessageRecord,
  QueryLocalMessagesInput,
  SearchMessageRecord,
  SearchMessagesInput,
} from '@tg-search/protocol'

import type { CoreDB } from '../db'
import type { Models } from '../models'

import { convertToCoreMessageFromDB, convertToCoreRetrievalMessages } from '../models/utils/message'
import { EmbeddingDimension } from '../types/account-settings'
import { coreMessageToRecord } from './remote-messages'

function cursorOffset(cursor?: string): number {
  const offset = Number.parseInt(cursor ?? '0', 10)
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
}

export function createLocalMessagesService(options: {
  db: CoreDB
  getAccountId: () => string
  logger: Logger
  models: Models
}) {
  const { db, getAccountId, logger, models } = options

  async function query(input: QueryLocalMessagesInput): Promise<CursorPage<MessageRecord>> {
    const offset = cursorOffset(input.cursor)
    const rows = (await models.chatMessageModels.fetchMessagesByTimeRange(
      db,
      getAccountId(),
      { start: input.from ?? 0, end: input.to ?? Number.MAX_SAFE_INTEGER },
      input.chatIds,
      { offset, limit: input.limit + 1 },
      input.fromUserId,
    )).expect('Failed to query local messages')

    const items = rows.map(convertToCoreMessageFromDB).map(coreMessageToRecord)
    return {
      items: items.slice(0, input.limit),
      nextCursor: items.length > input.limit ? String(offset + input.limit) : null,
    }
  }

  async function queryForExport(input: QueryLocalMessagesInput): Promise<CursorPage<ExportMessageRecord>> {
    const page = await query(input)
    const references = page.items.flatMap(message => message.replyToId
      ? [{ chatId: message.chatId, messageId: message.replyToId }]
      : [])
    if (references.length === 0)
      return page

    const replyRows = (await models.chatMessageModels.fetchMessagesByChatAndPlatformIds(
      db,
      getAccountId(),
      references,
    )).expect('Failed to resolve exported reply context')
    const replyByReference = new Map(
      replyRows
        .map(convertToCoreMessageFromDB)
        .map(coreMessageToRecord)
        .map(message => [`${message.chatId}:${message.id}`, message] as const),
    )

    return {
      ...page,
      items: page.items.map((message) => {
        if (!message.replyToId)
          return message
        return {
          ...message,
          replyTo: replyByReference.get(`${message.chatId}:${message.replyToId}`) ?? null,
        }
      }),
    }
  }

  async function search(input: SearchMessagesInput): Promise<CursorPage<SearchMessageRecord>> {
    const offset = cursorOffset(input.cursor)
    const rows = (await models.chatMessageModels.retrieveMessages(
      db,
      logger,
      getAccountId(),
      EmbeddingDimension.DIMENSION_1536,
      { text: input.query },
      { offset, limit: input.limit + 1 },
      {
        chatIds: input.chatIds,
        timeRange: { start: input.from, end: input.to },
      },
    )).expect('Failed to search local messages')

    const items = convertToCoreRetrievalMessages(rows).map(message => ({
      ...coreMessageToRecord(message),
      similarity: message.similarity,
      combinedScore: message.combinedScore,
    }))
    return {
      items: items.slice(0, input.limit),
      nextCursor: items.length > input.limit ? String(offset + input.limit) : null,
    }
  }

  async function context(input: MessageContextInput): Promise<MessageContext> {
    const messages = (await models.chatMessageModels.fetchMessageContextWithPhotos(
      db,
      models.photoModels,
      getAccountId(),
      { ...input, before: input.before, after: input.after },
    )).expect('Failed to query local message context')
    const items = messages.map(coreMessageToRecord)
    return {
      messages: items,
      targetIndex: items.findIndex(message => message.id === input.messageId),
    }
  }

  return { context, query, queryForExport, search }
}
