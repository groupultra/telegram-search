import type { InferOutput } from 'valibot'

import { boolean, number, object, optional, record, string, unknown } from 'valibot'

export const appErrorSchema = object({
  code: string(),
  message: string(),
  retryable: boolean(),
  retryAfterSeconds: optional(number()),
  details: optional(record(string(), unknown())),
})

export type AppError = InferOutput<typeof appErrorSchema>

export type AppResult<T>
  = | { ok: true, data: T }
    | { ok: false, error: AppError }

export function ok<T>(data: T): AppResult<T> {
  return { ok: true, data }
}

export function err(error: AppError): AppResult<never> {
  return { ok: false, error }
}
