import type { GenericSchema } from 'valibot'

import { array, boolean, literal, nullable, number, object, optional, pipe, string, toLowerCase, union, uuid } from 'valibot'

import { chatRecordSchema, listChatsInputSchema } from './chats'
import { appErrorSchema } from './errors'
import { listRemoteMessagesInputSchema, messageContextInputSchema, queryLocalMessagesInputSchema, searchMessagesInputSchema } from './messages'
import { statsInputSchema } from './stats'

const messageSchema = object({
  id: string(),
  chatId: string(),
  senderId: string(),
  senderName: string(),
  timestamp: number(),
  text: string(),
  replyToId: optional(string()),
  forward: object({ isForward: boolean(), fromChatId: optional(string()), fromChatName: optional(string()), fromMessageId: optional(string()) }),
  media: array(object({ type: string(), fileName: optional(string()), mimeType: optional(string()), telegramReference: optional(string()) })),
  links: array(object({ url: string(), title: optional(string()) })),
  editedAt: optional(number()),
  deletedAt: optional(number()),
  similarity: optional(number()),
  combinedScore: optional(number()),
})

const messagePageSchema = object({ items: array(messageSchema), nextCursor: nullable(string()), total: optional(number()) })

export const accountIdSchema = pipe(string('Expected a database account UUID'), uuid('Expected a database account UUID'), toLowerCase())

export const remoteMethods = {
  'chats.list': { input: listChatsInputSchema, output: object({ items: array(chatRecordSchema), nextCursor: nullable(string()), total: optional(number()) }) },
  'messages.list': { input: listRemoteMessagesInputSchema, output: messagePageSchema },
  'messages.query': { input: queryLocalMessagesInputSchema, output: messagePageSchema },
  'messages.search': { input: searchMessagesInputSchema, output: messagePageSchema },
  'messages.context': { input: messageContextInputSchema, output: object({ messages: array(messageSchema), targetIndex: number() }) },
  'stats.get': { input: statsInputSchema, output: object({ total: number(), buckets: array(object({ key: string(), count: number(), firstTimestamp: number(), lastTimestamp: number() })) }) },
} as const

export type RemoteMethod = keyof typeof remoteMethods

export function remoteResultSchema<Schema extends GenericSchema>(output: Schema) {
  return union([
    object({ ok: literal(true), data: output }),
    object({ ok: literal(false), error: appErrorSchema }),
  ])
}

export function normalizeRemoteUrl(value: string): string {
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Remote URL must not contain credentials, query parameters, or a fragment')
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && (url.protocol !== 'http:' || !loopback))
    throw new Error('Remote URL requires HTTPS (HTTP is allowed only on loopback)')
  return url.href.replace(/\/$/, '')
}
