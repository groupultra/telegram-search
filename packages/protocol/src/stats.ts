import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, number, object, optional, picklist, string } from 'valibot'

export const statsInputSchema = object({
  groupBy: optional(picklist(['month', 'chat', 'sender']), 'month'),
  timeZone: optional(string(), 'UTC'),
  chatIds: optional(array(string())),
  from: optional(number()),
  to: optional(number()),
})

export interface StatsBucket {
  key: string
  count: number
  firstTimestamp: number
  lastTimestamp: number
}

export interface StatsResult {
  total: number
  buckets: StatsBucket[]
}

export type StatsInput = InferOutput<typeof statsInputSchema>

export const statsContracts = {
  get: defineInvokeEventa<AppResult<StatsResult>, StatsInput>('tg.v1.stats.get'),
}
