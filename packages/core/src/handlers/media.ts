import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandlers } from '@moeru/eventa'
import { mediaContracts, readMessageMediaInputSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'
import { readOperationOptions } from './read-options'

export function registerMediaHandlers(context: EventContext<any, any>, application: TelegramApplication) {
  return defineInvokeHandlers(context, mediaContracts, {
    read: (input, options) => {
      const parsed = safeParse(readMessageMediaInputSchema, input)
      return parsed.success ? application.readMessageMedia(parsed.output, readOperationOptions(context.signal, input, options)) : invalidArgument('Invalid media read input')
    },
  })
}
