import type { GenericSchema } from 'valibot'

import { array, literal, nullable, number, object, optional, pipe, string, toLowerCase, union, uuid } from 'valibot'

import { chatRecordSchema, listChatsInputSchema } from './chats'
import { appErrorSchema } from './errors'
import { getMessagesInputSchema, getMessagesResultSchema, listRemoteMessagesInputSchema, messageContextInputSchema, messageRecordSchema, queryLocalMessagesInputSchema, readMessagesInputSchema, readMessagesResultSchema, replyContextInputSchema, replyContextResultSchema, searchMessagesInputSchema } from './messages'
import { statsInputSchema } from './stats'

const messagePageSchema = object({ items: array(object({ ...messageRecordSchema.entries, similarity: optional(number()), combinedScore: optional(number()) })), nextCursor: nullable(string()), total: optional(number()) })

export const accountIdSchema = pipe(string('Expected a database account UUID'), uuid('Expected a database account UUID'), toLowerCase())

export const remoteMethods = {
  'chats.list': { input: listChatsInputSchema, output: object({ items: array(chatRecordSchema), nextCursor: nullable(string()), total: optional(number()) }) },
  'messages.replies': { input: replyContextInputSchema, output: replyContextResultSchema },
  'messages.read': { input: readMessagesInputSchema, output: readMessagesResultSchema },
  'messages.get': { input: getMessagesInputSchema, output: getMessagesResultSchema },
  'messages.list': { input: listRemoteMessagesInputSchema, output: messagePageSchema },
  'messages.query': { input: queryLocalMessagesInputSchema, output: messagePageSchema },
  'messages.search': { input: searchMessagesInputSchema, output: messagePageSchema },
  'messages.context': { input: messageContextInputSchema, output: object({ messages: array(object({ ...messageRecordSchema.entries, similarity: optional(number()), combinedScore: optional(number()) })), targetIndex: number() }) },
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
