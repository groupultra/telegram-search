import type { InferOutput } from 'valibot'

import { defineInvokeEventa } from '@moeru/eventa'
import { number, object, optional, picklist, string } from 'valibot'

export const daemonStateSchema = picklist(['starting', 'ready', 'reconnecting', 'unauthorized', 'error', 'stopping'])

export const daemonStatusSchema = object({
  accountId: optional(string()),
  error: optional(string()),
  pid: number(),
  profile: string(),
  startedAt: number(),
  state: daemonStateSchema,
})

export type DaemonStatus = InferOutput<typeof daemonStatusSchema>

export const daemonContracts = {
  reload: defineInvokeEventa<DaemonStatus, Record<string, never>>('tg.v1.daemon.reload'),
  status: defineInvokeEventa<DaemonStatus, Record<string, never>>('tg.v1.daemon.status'),
  stop: defineInvokeEventa<DaemonStatus, Record<string, never>>('tg.v1.daemon.stop'),
}
