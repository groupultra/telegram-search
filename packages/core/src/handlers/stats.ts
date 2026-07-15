import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandler } from '@moeru/eventa'
import { statsContracts, statsInputSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'

export function registerStatsHandler(context: EventContext<any, any>, application: TelegramApplication) {
  return defineInvokeHandler(context, statsContracts.get, (input) => {
    const parsed = safeParse(statsInputSchema, input)
    return parsed.success
      ? application.getLocalStats(parsed.output)
      : invalidArgument('Invalid stats input')
  })
}
