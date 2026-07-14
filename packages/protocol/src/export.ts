import type { InferOutput } from 'valibot'

import type { AppError } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, literal, number, object, optional, string } from 'valibot'

export const exportInputSchema = object({
  outputDir: string(),
  format: optional(literal('jsonl'), 'jsonl'),
  timeZone: optional(string(), 'UTC'),
  chatIds: optional(array(string())),
  from: optional(number()),
  to: optional(number()),
})

export type ExportInput = InferOutput<typeof exportInputSchema>

export type ExportUpdate
  = | { type: 'started', taskId: string }
    | { type: 'progress', taskId: string, file: string, exported: number }
    | { type: 'completed', taskId: string, files: string[], exported: number }
    | { type: 'failed', taskId: string, error: AppError }

export const exportContracts = {
  run: defineInvokeEventa<ExportUpdate, ExportInput>('tg.v1.export.run'),
}
