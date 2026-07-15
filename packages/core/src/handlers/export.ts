import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineStreamInvokeHandler } from '@moeru/eventa'
import { exportContracts, exportInputSchema } from '@tg-search/protocol'
import { v4 as uuidv4 } from 'uuid'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'

export function registerExportHandler(context: EventContext<any, any>, application: TelegramApplication) {
  defineStreamInvokeHandler(context, exportContracts.run, async function* (input, options) {
    const parsed = safeParse(exportInputSchema, input)
    if (!parsed.success) {
      yield { type: 'failed', taskId: uuidv4(), error: invalidArgument('Invalid export input').error }
      return
    }
    yield* application.exportLocal(parsed.output, options?.abortController?.signal)
  })
}
