import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'
import type { CursorPage } from './pagination'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, boolean, check, integer, literal, maxLength, maxValue, minLength, minValue, nullable, number, object, optional, picklist, pipe, regex, safeParse, string } from 'valibot'

import { readOperationFields } from './operation'

import { readOperationFields } from './operation'

const timeRangeFields = {
  from: optional(number()),
  to: optional(number()),
}

export const localMessageCursorSchema = pipe(string(), regex(/^(?:0|[1-9]\d{0,15})$/), check(value => Number.isSafeInteger(Number(value)), 'Local cursor must be a non-negative safe integer offset'))
const telegramMessageIdSchema = pipe(string(), regex(/^[1-9]\d{0,15}$/), check(value => Number.isSafeInteger(Number(value)), 'Telegram message ID must be a positive safe integer'))

export const listRemoteMessagesInputSchema = object({
  ...readOperationFields,
  chatId: pipe(string(), minLength(1), maxLength(128)),
  /** Message ID to read strictly below: a previous page's `nextCursor`, or any known message ID. */
  cursor: optional(telegramMessageIdSchema),
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
  cursor: optional(localMessageCursorSchema),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  fromUserId: optional(string()),
  ...timeRangeFields,
})

export const searchMessagesInputSchema = object({
  ...readOperationFields,
  query: pipe(string(), minLength(1), maxLength(4000)),
  chatIds: optional(array(pipe(string(), minLength(1), maxLength(128)))),
  cursor: optional(localMessageCursorSchema),
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
  messageIds: pipe(array(telegramMessageIdSchema), minLength(1), maxLength(100)),
})
export const getMessagesResultSchema = object({
  source: picklist(['local', 'telegram']),
  items: array(messageRecordSchema),
  missingIds: array(string()),
})
export type GetMessagesInput = InferOutput<typeof getMessagesInputSchema>
export type GetMessagesResult = InferOutput<typeof getMessagesResultSchema>

const referenceSchema = object({ chatId: string(), messageId: string() })
const replyStatusSchema = picklist(['resolved', 'missing', 'not_requested', 'depth_budget', 'node_budget', 'cycle'])
export const replyContextInputSchema = object({
  ...getMessagesInputSchema.entries,
  maxDepth: optional(pipe(number(), integer(), minValue(0), maxValue(10)), 1),
  maxNodes: optional(pipe(number(), integer(), minValue(1), maxValue(1000)), 100),
})
export const replyContextResultSchema = object({
  source: picklist(['local', 'telegram']),
  items: array(messageRecordSchema),
  roots: array(object({ ...referenceSchema.entries, status: picklist(['resolved', 'missing', 'node_budget']) })),
  links: array(object({ from: referenceSchema, to: referenceSchema, status: replyStatusSchema, reason: optional(picklist(['cross_chat', 'depth_zero'])) })),
  budget: object({ maxDepth: number(), maxNodes: number() }),
  coverage: object({ complete: boolean(), resolvedReplies: number(), missingReplies: number(), notRequestedReplies: number(), depthStopped: number(), nodeStopped: number(), cycles: number() }),
})
export const readMessagesInputSchema = pipe(object({
  ...readOperationFields,
  source: picklist(['local', 'telegram']),
  chatId: pipe(string(), minLength(1), maxLength(128)),
  cursor: optional(string()),
  pageSize: optional(pipe(number(), integer(), minValue(1), maxValue(1000)), 100),
  maxPages: optional(pipe(number(), integer(), minValue(1), maxValue(100)), 10),
  maxMessages: optional(pipe(number(), integer(), minValue(1), maxValue(10000)), 1000),
  ...timeRangeFields,
}), check(input => input.from === undefined || input.to === undefined || input.from <= input.to, 'from must be before or equal to to'), check(input => input.cursor === undefined || safeParse(input.source === 'telegram' ? telegramMessageIdSchema : localMessageCursorSchema, input.cursor).success, 'Cursor must match the selected source'))

export const readMessagesResultSchema = object({
  source: picklist(['local', 'telegram']),
  chatId: string(),
  items: array(messageRecordSchema),
  window: object(timeRangeFields),
  nextCursor: nullable(string()),
  pagesRead: number(),
  stopReason: picklist(['exhausted', 'page_budget', 'message_budget', 'cursor_stalled']),
  coverage: object({ windowExhausted: boolean(), replyContext: literal('not_requested'), mediaContent: literal('not_requested') }),
})
export type ReplyContextInput = InferOutput<typeof replyContextInputSchema>
export type ReplyContextResult = InferOutput<typeof replyContextResultSchema>
export type ReadMessagesInput = InferOutput<typeof readMessagesInputSchema>
export type ReadMessagesResult = InferOutput<typeof readMessagesResultSchema>

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
  replies: defineInvokeEventa<AppResult<ReplyContextResult>, ReplyContextInput>('tg.v1.messages.replies'),
  read: defineInvokeEventa<AppResult<ReadMessagesResult>, ReadMessagesInput>('tg.v1.messages.read'),
  get: defineInvokeEventa<AppResult<GetMessagesResult>, GetMessagesInput>('tg.v1.messages.get'),
  listRemote: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, ListRemoteMessagesInput>('tg.v1.messages.list.remote'),
  queryLocal: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, QueryLocalMessagesInput>('tg.v1.messages.query.local'),
  searchLocal: defineInvokeEventa<AppResult<CursorPage<SearchMessageRecord>>, SearchMessagesInput>('tg.v1.messages.search.local'),
  contextLocal: defineInvokeEventa<AppResult<MessageContext>, MessageContextInput>('tg.v1.messages.context.local'),
}
