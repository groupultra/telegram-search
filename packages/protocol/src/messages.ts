import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'
import type { CursorPage } from './pagination'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, boolean, maxLength, maxValue, minLength, minValue, number, object, optional, pipe, string } from 'valibot'

const timeRangeFields = {
  from: optional(number()),
  to: optional(number()),
}

export const listRemoteMessagesInputSchema = object({
  chatId: pipe(string(), minLength(1), maxLength(128)),
  cursor: optional(string()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  fromUserId: optional(string()),
  minMessageId: optional(pipe(number(), minValue(0))),
  ...timeRangeFields,
})

export const queryLocalMessagesInputSchema = object({
  chatIds: optional(array(pipe(string(), minLength(1), maxLength(128)))),
  cursor: optional(string()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  fromUserId: optional(string()),
  ...timeRangeFields,
})

export const searchMessagesInputSchema = object({
  query: pipe(string(), minLength(1), maxLength(4000)),
  chatIds: optional(array(pipe(string(), minLength(1), maxLength(128)))),
  cursor: optional(string()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  useVector: optional(boolean(), false),
  ...timeRangeFields,
})

export const messageContextInputSchema = object({
  chatId: pipe(string(), minLength(1), maxLength(128)),
  messageId: pipe(string(), minLength(1), maxLength(128)),
  before: optional(pipe(number(), minValue(0), maxValue(1000)), 20),
  after: optional(pipe(number(), minValue(0), maxValue(1000)), 20),
})

export interface MessageForwardRecord {
  isForward: boolean
  fromChatId?: string
  fromChatName?: string
  fromMessageId?: string
}

export interface MessageMediaRecord {
  type: string
  fileName?: string
  mimeType?: string
  telegramReference?: string
}

export interface MessageLinkRecord {
  url: string
  title?: string
}

export interface MessageRecord {
  id: string
  chatId: string
  senderId: string
  senderName: string
  timestamp: number
  text: string
  replyToId?: string
  forward: MessageForwardRecord
  media: MessageMediaRecord[]
  links: MessageLinkRecord[]
  editedAt?: number
  deletedAt?: number
}

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
  listRemote: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, ListRemoteMessagesInput>('tg.v1.messages.list.remote'),
  queryLocal: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, QueryLocalMessagesInput>('tg.v1.messages.query.local'),
  searchLocal: defineInvokeEventa<AppResult<CursorPage<SearchMessageRecord>>, SearchMessagesInput>('tg.v1.messages.search.local'),
  contextLocal: defineInvokeEventa<AppResult<MessageContext>, MessageContextInput>('tg.v1.messages.context.local'),
}
