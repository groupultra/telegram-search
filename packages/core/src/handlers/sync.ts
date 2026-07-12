import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineStreamInvokeHandler } from '@moeru/eventa'
import { syncContracts, syncInputSchema } from '@tg-search/protocol'
import { v4 as uuidv4 } from 'uuid'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'

export function registerSyncHandler(context: EventContext<any, any>, application: TelegramApplication) {
  defineStreamInvokeHandler(context, syncContracts.run, async function* (input, options) {
    const parsed = safeParse(syncInputSchema, input)
    if (!parsed.success || (parsed.output.chatIds.length === 0 && !parsed.output.all)) {
      yield {
        type: 'failed',
        taskId: uuidv4(),
        error: invalidArgument('Sync requires at least one chat or all=true').error,
      }
      return
    }
    yield* application.sync(parsed.output, options?.abortController?.signal)
  })
}
