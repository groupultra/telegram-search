import type { AppError, RuntimeBuild } from '@tg-search/protocol'

import process from 'node:process'

import { writeResultFile } from './result-file'

export interface OutputMeta {
  execution?: { mode: 'cli' | 'direct' | 'daemon' | 'remote', cli: RuntimeBuild, daemon?: RuntimeBuild }
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
export type OutputFormat = 'json' | 'text' | 'compact' | 'jsonl'

let outputFormat: OutputFormat = 'text'
let outputFile: string | undefined

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

export function resetOutputState(format: OutputFormat, file?: string): void {
  outputWritten = false
  outputFormat = format
  outputFile = file
}

export function isJsonOutput(): boolean {
  return outputFormat !== 'text'
}

export function writeOutput<T>(data: T, meta: OutputMeta, nextCursor?: string | null): void {
  const envelope: SuccessEnvelope<T> = {
    ok: true,
    data,
    ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
    meta,
  }
  if (outputFile) {
    const file = writeResultFile(outputFile, formatOutput(envelope, outputFormat))
    const receipt: SuccessEnvelope<typeof file & { format: OutputFormat }> = { ...envelope, data: { ...file, format: outputFormat } }
    outputWritten = true
    process.stdout.write(outputFormat === 'text' ? `${formatHumanValue(receipt.data)}\n` : `${JSON.stringify(receipt)}\n`)
    return
  }
  for (const chunk of formatOutput(envelope, outputFormat)) {
    process.stdout.write(chunk)
    outputWritten = true
  }
}

export function writeFailure(error: AppError, meta: OutputMeta): void {
  outputWritten = true
  if (isJsonOutput()) {
    process.stdout.write(`${JSON.stringify({ ok: false, error, meta } satisfies FailureEnvelope)}\n`)
    return
  }
  process.stderr.write(`${error.code}: ${error.message}\n`)
}

export function writeProgress(data: unknown): void {
  process.stderr.write(isJsonOutput() ? `${JSON.stringify(data)}\n` : `${formatHumanValue(data)}\n`)
}

/** Every array item stays intact, including relation and future schema fields. */
export function* formatOutput<T>(envelope: SuccessEnvelope<T>, format: OutputFormat): Generator<string> {
  if (format === 'text') {
    yield `${formatHumanValue(envelope.data)}\n`
    return
  }
  if (format === 'json') {
    yield `${JSON.stringify(envelope)}\n`
    return
  }
  const data = envelope.data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    yield `${JSON.stringify({ type: 'result', status: 'partial', ...envelope })}\n`
  }
  else {
    const arrays = Object.entries(data).filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
    const header = { ...envelope, data: Object.fromEntries(Object.entries(data).filter(([, value]) => !Array.isArray(value))) }
    if (format === 'compact') {
      yield `Result: ${JSON.stringify({ ...header, status: 'partial', arrays: arrays.map(([key, values]) => ({ key, count: values.length })) })}\n`
      for (const [key, values] of arrays) {
        for (const [index, item] of values.entries())
          yield `${key}[${index}]: ${JSON.stringify(item)}\n`
      }
    }
    else {
      yield `${JSON.stringify({ type: 'result', status: 'partial', ...header, arrays: arrays.map(([key, values]) => ({ key, count: values.length })) })}\n`
      for (const [key, values] of arrays) {
        for (const [index, item] of values.entries())
          yield `${JSON.stringify({ type: 'item', key, index, data: item })}\n`
      }
    }
  }
  // This completes serialization of this result only; pagination/coverage is unchanged.
  yield format === 'compact' ? 'Output: completed\n' : `${JSON.stringify({ type: 'completed', status: 'completed', ok: true })}\n`
}
