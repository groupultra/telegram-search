import type { InferOutput } from 'valibot'

import { maxValue, minValue, number, object, optional, pipe, string } from 'valibot'

export const cursorInputSchema = object({
  cursor: optional(string()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
})

export type CursorInput = InferOutput<typeof cursorInputSchema>

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  /** Total matching records when the upstream API provides an exact count. */
  total?: number
}
