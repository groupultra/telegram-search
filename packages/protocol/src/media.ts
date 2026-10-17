import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { check, integer, literal, maxLength, maxValue, minLength, minValue, nullable, number, object, optional, pick, picklist, pipe, regex, string } from 'valibot'

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

// Links authorize a whole attachment. Arbitrary byte offsets and caller-selected
// expiration are intentionally absent; the remote service owns the link lifetime.
export const createMediaLinkInputSchema = object({
  ...pick(readMessageMediaInputSchema, ['operation', 'source', 'chatId', 'messageId', 'mediaIndex', 'maxBytes']).entries,
  chatId: pipe(string(), minLength(1), maxLength(128)),
})

export const mediaDownloadLinkSchema = object({
  // A relative path avoids trusting Host / forwarded headers. Remote clients
  // append it to their configured endpoint before passing the URL to a model.
  path: pipe(string(), maxLength(4096), regex(/^\/v1\/remote\/media\.download\?ticket=[\w-]+$/)),
  /** Absolute expiry in Unix milliseconds. */
  expiresAt: pipe(number(), integer(), minValue(1), maxValue(Number.MAX_SAFE_INTEGER)),
  media: object({
    type: pipe(string(), minLength(1)),
    size: pipe(number(), integer(), minValue(0), maxValue(50 * 1024 * 1024)),
    mimeType: optional(string()),
    fileName: optional(string()),
  }),
})

export type CreateMediaLinkInput = InferOutput<typeof createMediaLinkInputSchema>
export type MediaDownloadLink = InferOutput<typeof mediaDownloadLinkSchema>
export type ReadMessageMediaInput = InferOutput<typeof readMessageMediaInputSchema>
export type MessageMediaChunk = InferOutput<typeof messageMediaChunkSchema>

export const mediaContracts = {
  read: defineInvokeEventa<AppResult<MessageMediaChunk>, ReadMessageMediaInput>('tg.v1.media.read'),
}
