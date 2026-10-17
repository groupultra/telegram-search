import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandlers } from '@moeru/eventa'
import { chatContracts, listChatsInputSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'
import { readOperationOptions } from './read-options'

export function registerChatHandlers(context: EventContext<any, any>, application: TelegramApplication) {
  return defineInvokeHandlers(context, chatContracts, {
    list: (input, options) => {
      const parsed = safeParse(listChatsInputSchema, input)
      return parsed.success
        ? application.listChats(parsed.output, readOperationOptions(context.signal, parsed.output, options))
        : invalidArgument('Invalid chats list input', { issues: parsed.issues })
    },
  })
}
