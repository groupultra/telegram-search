import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'
import type { CursorPage } from './pagination'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, boolean, maxLength, maxValue, minLength, minValue, number, object, optional, picklist, pipe, regex, string } from 'valibot'

import { readOperationFields } from './operation'

const timeRangeFields = {
  from: optional(number()),
  to: optional(number()),
}

export const listRemoteMessagesInputSchema = object({
  ...readOperationFields,
  chatId: pipe(string(), minLength(1), maxLength(128)),
  /** Message ID to read strictly below: a previous page's `nextCursor`, or any known message ID. */
  cursor: optional(pipe(string(), regex(/^[1-9]\d{0,15}$/))),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  /** Server-side text search within the chat. */
  query: optional(pipe(string(), minLength(1), maxLength(4000))),
  fromUserId: optional(string()),
  minMessageId: optional(pipe(number(), minValue(0))),
  ...timeRangeFields,
})

export const queryLocalMessagesInputSchema = object({
  ...readOperationFields,
  chatIds: optional(array(pipe(string(), minLength(1), maxLength(128)))),
  cursor: optional(string()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  fromUserId: optional(string()),
  ...timeRangeFields,
})

export const searchMessagesInputSchema = object({
  ...readOperationFields,
  query: pipe(string(), minLength(1), maxLength(4000)),
  chatIds: optional(array(pipe(string(), minLength(1), maxLength(128)))),
  cursor: optional(string()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  useVector: optional(boolean(), false),
  ...timeRangeFields,
})

export const messageContextInputSchema = object({
  ...readOperationFields,
  chatId: pipe(string(), minLength(1), maxLength(128)),
  messageId: pipe(string(), minLength(1), maxLength(128)),
  before: optional(pipe(number(), minValue(0), maxValue(1000)), 20),
  after: optional(pipe(number(), minValue(0), maxValue(1000)), 20),
})

export const messageForwardRecordSchema = object({
  isForward: boolean(),
  fromChatId: optional(string()),
  fromChatName: optional(string()),
  fromMessageId: optional(string()),
  fromSenderId: optional(string()),
  fromName: optional(string()),
  date: optional(number()),
  postAuthor: optional(string()),
})

export const messageMediaRecordSchema = object({
  type: string(),
  fileName: optional(string()),
  mimeType: optional(string()),
  telegramReference: optional(string()),
})
export const messageLinkRecordSchema = object({ url: string(), title: optional(string()) })
export const messageQuoteSchema = object({ text: string(), offset: optional(number()), manual: optional(boolean()) })

/** Canonical wire schema: all transports preserve the same message facts. */
export const messageRecordSchema = object({
  id: string(),
  chatId: string(),
  senderId: string(),
  senderName: string(),
  timestamp: number(),
  text: string(),
  replyToId: optional(string()),
  replyToChatId: optional(string()),
  replyToTopId: optional(string()),
  forumTopic: optional(boolean()),
  quote: optional(messageQuoteSchema),
  groupedId: optional(string()),
  forward: messageForwardRecordSchema,
  media: array(messageMediaRecordSchema),
  links: array(messageLinkRecordSchema),
  editedAt: optional(number()),
  deletedAt: optional(number()),
})

export type MessageForwardRecord = InferOutput<typeof messageForwardRecordSchema>
export type MessageMediaRecord = InferOutput<typeof messageMediaRecordSchema>
export type MessageLinkRecord = InferOutput<typeof messageLinkRecordSchema>
export type MessageRecord = InferOutput<typeof messageRecordSchema>
export type MessageSource = 'local' | 'telegram'

export const getMessagesInputSchema = object({
  ...readOperationFields,
  source: picklist(['local', 'telegram']),
  chatId: pipe(string(), minLength(1), maxLength(128)),
  messageIds: pipe(array(pipe(string(), regex(/^[1-9]\d{0,15}$/))), minLength(1), maxLength(100)),
})
export const getMessagesResultSchema = object({
  source: picklist(['local', 'telegram']),
  items: array(messageRecordSchema),
  missingIds: array(string()),
})
export type GetMessagesInput = InferOutput<typeof getMessagesInputSchema>
export type GetMessagesResult = InferOutput<typeof getMessagesResultSchema>

export interface SearchMessageRecord extends MessageRecord {
  similarity?: number
  combinedScore?: number
}

export interface MessageContext {
  messages: MessageRecord[]
  targetIndex: number
}

export type ListRemoteMessagesInput = InferOutput<typeof listRemoteMessagesInputSchema>
export type QueryLocalMessagesInput = InferOutput<typeof queryLocalMessagesInputSchema>
export type SearchMessagesInput = InferOutput<typeof searchMessagesInputSchema>
export type MessageContextInput = InferOutput<typeof messageContextInputSchema>

export const messageContracts = {
  get: defineInvokeEventa<AppResult<GetMessagesResult>, GetMessagesInput>('tg.v1.messages.get'),
  listRemote: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, ListRemoteMessagesInput>('tg.v1.messages.list.remote'),
  queryLocal: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, QueryLocalMessagesInput>('tg.v1.messages.query.local'),
  searchLocal: defineInvokeEventa<AppResult<CursorPage<SearchMessageRecord>>, SearchMessagesInput>('tg.v1.messages.search.local'),
  contextLocal: defineInvokeEventa<AppResult<MessageContext>, MessageContextInput>('tg.v1.messages.context.local'),
}
