import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandler } from '@moeru/eventa'
import { statsContracts, statsInputSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'
import { readOperationOptions } from './read-options'

export function registerStatsHandler(context: EventContext<any, any>, application: TelegramApplication) {
  return defineInvokeHandler(context, statsContracts.get, (input, options) => {
    const parsed = safeParse(statsInputSchema, input)
    return parsed.success
      ? application.getLocalStats(parsed.output, readOperationOptions(context.signal, parsed.output, options))
      : invalidArgument('Invalid stats input')
  })
}
