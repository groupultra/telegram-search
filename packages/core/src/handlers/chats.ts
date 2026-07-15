import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandlers } from '@moeru/eventa'
import { chatContracts, listChatsInputSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'

export function registerChatHandlers(context: EventContext<any, any>, application: TelegramApplication) {
  return defineInvokeHandlers(context, chatContracts, {
    list: (input) => {
      const parsed = safeParse(listChatsInputSchema, input)
      return parsed.success
        ? application.listChats(parsed.output)
        : invalidArgument('Invalid chats list input', { issues: parsed.issues })
    },
  })
}
