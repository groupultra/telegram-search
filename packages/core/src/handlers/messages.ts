import type { EventContext } from '@moeru/eventa'
import type { GetMessagesInput, ReadMessagesInput, ReplyContextInput } from '@tg-search/protocol'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandlers } from '@moeru/eventa'
import {
  getMessagesInputSchema,
  listRemoteMessagesInputSchema,
  messageContextInputSchema,
  messageContracts,
  queryLocalMessagesInputSchema,
  readMessagesInputSchema,
  replyContextInputSchema,
  searchMessagesInputSchema,
} from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'
import { readOperationOptions } from './read-options'

function validated<TInput, TOutput>(schema: Parameters<typeof safeParse>[0], input: unknown, operation: (input: TInput) => Promise<TOutput>) {
  const parsed = safeParse(schema, input)
  return parsed.success
    ? operation(parsed.output as TInput)
    : invalidArgument('Invalid message input', { issues: parsed.issues })
}

export function registerMessageHandlers(context: EventContext<any, any>, application: TelegramApplication) {
  return defineInvokeHandlers(context, messageContracts, {
    replies: (input, options) => validated(replyContextInputSchema, input, parsed => application.getReplyContext(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    read: (input, options) => validated(readMessagesInputSchema, input, parsed => application.readMessages(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    get: (input, options) => validated(getMessagesInputSchema, input, parsed => application.getMessages(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    listRemote: (input, options) => validated(listRemoteMessagesInputSchema, input, parsed => application.listRemoteMessages(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    queryLocal: (input, options) => validated(queryLocalMessagesInputSchema, input, parsed => application.queryLocalMessages(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    searchLocal: (input, options) => validated(searchMessagesInputSchema, input, parsed => application.searchLocalMessages(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    contextLocal: (input, options) => validated(messageContextInputSchema, input, parsed => application.getLocalMessageContext(parsed as typeof input, readOperationOptions(context.signal, input, options))),
  })
}
