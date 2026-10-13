import type { AppError } from '@tg-search/protocol'

import process from 'node:process'

export interface OutputMeta {
  profile: string
  source: 'local' | 'telegram' | 'cli' | 'remote'
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

let outputWritten = false
let outputFormat: 'json' | 'text' = 'text'

function humanLabel(key: string): string {
  const words = key.replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll(/[-_]+/g, ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

function escapeTerminalControls(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.charCodeAt(0)
    const isTerminalControl = codePoint <= 0x09
      || (codePoint >= 0x0B && codePoint <= 0x1F)
      || (codePoint >= 0x7F && codePoint <= 0x9F)
    if (!isTerminalControl)
      return character
    if (character === '\r')
      return '\\r'
    if (character === '\t')
      return '\\t'
    return `\\x${codePoint.toString(16).padStart(2, '0')}`
  }).join('')
}

function humanScalar(value: null | boolean | number | string, continuationIndent: string): string {
  if (value === null)
    return 'none'
  if (typeof value === 'string')
    return escapeTerminalControls(value).replaceAll('\n', `\n${continuationIndent}`)
  return String(value)
}

function isHumanScalar(value: unknown): value is null | boolean | number | string {
  return value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
}

function formatHumanValue(value: unknown, indentation = 0): string {
  const indent = ' '.repeat(indentation)
  if (isHumanScalar(value))
    return `${indent}${humanScalar(value, indent)}`

  if (Array.isArray(value)) {
    if (value.length === 0)
      return `${indent}(none)`
    return value.map((item) => {
      if (isHumanScalar(item))
        return `${indent}- ${humanScalar(item, `${indent}  `)}`
      return `${indent}-\n${formatHumanValue(item, indentation + 2)}`
    }).join('\n')
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0)
      return `${indent}(none)`
    return entries.map(([key, item]) => {
      const label = humanLabel(key)
      if (isHumanScalar(item))
        return `${indent}${label}: ${humanScalar(item, `${indent}  `)}`
      return `${indent}${label}:\n${formatHumanValue(item, indentation + 2)}`
    }).join('\n')
  }

  return `${indent}${String(value)}`
}

export function hasWrittenOutput(): boolean {
  return outputWritten
}

export function resetOutputState(format: 'json' | 'text'): void {
  outputWritten = false
  outputFormat = format
}

export function isJsonOutput(): boolean {
  return outputFormat === 'json'
}

export function writeOutput<T>(data: T, meta: OutputMeta, nextCursor?: string | null): void {
  const envelope: SuccessEnvelope<T> = {
    ok: true,
    data,
    ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
    meta,
  }
  outputWritten = true
  process.stdout.write(outputFormat === 'json' ? `${JSON.stringify(envelope)}\n` : `${formatHumanValue(data)}\n`)
}

export function writeFailure(error: AppError, meta: OutputMeta): void {
  outputWritten = true
  if (outputFormat === 'json') {
    process.stdout.write(`${JSON.stringify({ ok: false, error, meta } satisfies FailureEnvelope)}\n`)
    return
  }
  process.stderr.write(`${error.code}: ${error.message}\n`)
}

export function writeProgress(data: unknown): void {
  process.stderr.write(outputFormat === 'json' ? `${JSON.stringify(data)}\n` : `${formatHumanValue(data)}\n`)
}
