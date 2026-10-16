import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { check, integer, literal, maxValue, minLength, minValue, nullable, number, object, optional, picklist, pipe, regex, string } from 'valibot'

import { readOperationFields } from './operation'

// Base64 expands bytes by one third. A 256 KiB chunk stays below Eventa's 1 MiB frame limit.
export const MEDIA_CHUNK_BYTES = 256 * 1024

export const readMessageMediaInputSchema = object({
  ...readOperationFields,
  source: picklist(['local', 'telegram']),
  chatId: pipe(string(), minLength(1)),
  messageId: pipe(string(), regex(/^[1-9]\d{0,15}$/), check(value => Number.isSafeInteger(Number(value)), 'Expected a safe message ID')),
  mediaIndex: optional(pipe(number(), integer(), minValue(0), maxValue(Number.MAX_SAFE_INTEGER)), 0),
  offset: optional(pipe(number(), integer(), minValue(0), maxValue(Number.MAX_SAFE_INTEGER)), 0),
  length: optional(pipe(number(), integer(), minValue(1), maxValue(MEDIA_CHUNK_BYTES)), 64 * 1024),
  maxBytes: optional(pipe(number(), integer(), minValue(1), maxValue(50 * 1024 * 1024)), 10 * 1024 * 1024),
})

export const messageMediaChunkSchema = object({
  source: picklist(['local', 'telegram']),
  chatId: string(),
  messageId: string(),
  mediaIndex: number(),
  type: string(),
  fileName: optional(string()),
  mimeType: optional(string()),
  size: number(),
  encoding: literal('base64'),
  data: string(),
  offset: number(),
  nextOffset: nullable(number()),
  contentStatus: picklist(['partial', 'complete']),
})

export type ReadMessageMediaInput = InferOutput<typeof readMessageMediaInputSchema>
export type MessageMediaChunk = InferOutput<typeof messageMediaChunkSchema>

export const mediaContracts = {
  read: defineInvokeEventa<AppResult<MessageMediaChunk>, ReadMessageMediaInput>('tg.v1.media.read'),
}
