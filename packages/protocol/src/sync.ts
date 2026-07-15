import type { InferOutput } from 'valibot'

import type { AppError } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, boolean, maxValue, minValue, number, object, optional, pipe, string } from 'valibot'

export const syncInputSchema = object({
  chatIds: optional(array(string()), []),
  all: optional(boolean(), false),
  takeout: optional(boolean(), false),
  from: optional(number()),
  to: optional(number()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000000)), 100000),
})

export type SyncInput = InferOutput<typeof syncInputSchema>

export type SyncUpdate
  = | { type: 'started', taskId: string }
    | { type: 'progress', taskId: string, processed: number, total?: number }
    | { type: 'checkpoint', taskId: string, chatId: string, messageId: string }
    | { type: 'completed', taskId: string, processed: number }
    | { type: 'failed', taskId: string, error: AppError }

export const syncContracts = {
  run: defineInvokeEventa<SyncUpdate, SyncInput>('tg.v1.sync.run'),
}
