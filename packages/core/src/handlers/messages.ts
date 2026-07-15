import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandlers } from '@moeru/eventa'
import {
  listRemoteMessagesInputSchema,
  messageContextInputSchema,
  messageContracts,
  queryLocalMessagesInputSchema,
  searchMessagesInputSchema,
} from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'

function validated<TInput, TOutput>(schema: Parameters<typeof safeParse>[0], input: unknown, operation: (input: TInput) => Promise<TOutput>) {
  const parsed = safeParse(schema, input)
  return parsed.success
    ? operation(parsed.output as TInput)
    : invalidArgument('Invalid message input', { issues: parsed.issues })
}

export function registerMessageHandlers(context: EventContext<any, any>, application: TelegramApplication) {
  return defineInvokeHandlers(context, messageContracts, {
    listRemote: input => validated(listRemoteMessagesInputSchema, input, application.listRemoteMessages),
    queryLocal: input => validated(queryLocalMessagesInputSchema, input, application.queryLocalMessages),
    searchLocal: input => validated(searchMessagesInputSchema, input, application.searchLocalMessages),
    contextLocal: input => validated(messageContextInputSchema, input, application.getLocalMessageContext),
  })
}
