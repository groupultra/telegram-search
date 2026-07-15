import type { AppError } from '@tg-search/protocol'

import process from 'node:process'

export interface OutputMeta {
  profile: string
  source: 'local' | 'telegram' | 'cli'
}

export interface SuccessEnvelope<T> {
  ok: true
  data: T
  next_cursor?: string | null
  meta: OutputMeta
}

export interface FailureEnvelope {
  ok: false
  error: AppError
  meta: OutputMeta
}

let envelopeWritten = false

export function hasWrittenEnvelope(): boolean {
  return envelopeWritten
}

export function resetEnvelopeState(): void {
  envelopeWritten = false
}

export function writeOutput<T>(data: T, meta: OutputMeta, nextCursor?: string | null): void {
  const envelope: SuccessEnvelope<T> = {
    ok: true,
    data,
    ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
    meta,
  }
  envelopeWritten = true
  process.stdout.write(`${JSON.stringify(envelope)}\n`)
}

export function writeFailure(error: AppError, meta: OutputMeta): void {
  envelopeWritten = true
  process.stdout.write(`${JSON.stringify({ ok: false, error, meta } satisfies FailureEnvelope)}\n`)
}

export function writeProgress(data: unknown): void {
  process.stderr.write(`${JSON.stringify(data)}\n`)
}
