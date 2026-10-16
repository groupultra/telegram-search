import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { boolean, number, object, optional, picklist, string } from 'valibot'

export const daemonStateSchema = picklist(['starting', 'ready', 'reconnecting', 'unauthorized', 'error', 'stopping'])

const healthTimes = { changedAt: number(), lastSuccessAt: optional(number()) }
const readHealthSchema = object({ state: picklist(['unknown', 'available', 'failed']), ...healthTimes, lastFailureAt: optional(number()), errorCode: optional(string()) })

export const daemonHealthSchema = object({
  transport: object({ state: picklist(['starting', 'connected', 'disconnected', 'broken']), ...healthTimes }),
  authorization: object({ state: picklist(['unknown', 'authorized', 'unauthorized']), ...healthTimes }),
  catchUp: object({ state: picklist(['unknown', 'running', 'idle', 'failed']), ...healthTimes, error: optional(string()) }),
  reads: object({ telegram: readHealthSchema, local: readHealthSchema }),
  recovery: object({ attempts: number(), inProgress: boolean(), lastAttemptAt: optional(number()), lastSuccessAt: optional(number()) }),
})

export const runtimeBuildSchema = object({ version: string(), artifact: string(), artifactDigest: string(), nodeVersion: string() })
export type RuntimeBuild = InferOutput<typeof runtimeBuildSchema>
export type DaemonHealth = InferOutput<typeof daemonHealthSchema>

export const daemonStatusSchema = object({
  health: daemonHealthSchema,
  build: runtimeBuildSchema,
  accountId: optional(string()),
  error: optional(string()),
  pid: number(),
  profile: string(),
  startedAt: number(),
  state: daemonStateSchema,
})

export type DaemonStatus = InferOutput<typeof daemonStatusSchema>

export const daemonContracts = {
  recover: defineInvokeEventa<AppResult<DaemonStatus>, Record<string, never>>('tg.v1.daemon.recover'),
  reload: defineInvokeEventa<DaemonStatus, Record<string, never>>('tg.v1.daemon.reload'),
  status: defineInvokeEventa<DaemonStatus, Record<string, never>>('tg.v1.daemon.status'),
  stop: defineInvokeEventa<DaemonStatus, Record<string, never>>('tg.v1.daemon.stop'),
}
