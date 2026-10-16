import type { OutputFormat } from './output'

import { cliError } from './cli-errors'

export const readOutputArgs = {
  format: { type: 'string' as const, description: 'Output format: text, json, compact, or jsonl' },
  outputFile: { type: 'string' as const, description: 'Write this result to a new private file (defaults to JSONL)' },
}

const READ_COMMANDS = new Set(['chats', 'messages', 'media', 'search', 'context', 'stats'])
const OUTPUT_FORMATS: readonly OutputFormat[] = ['text', 'json', 'compact', 'jsonl']

function isOutputFormat(value: string | undefined): value is OutputFormat {
  return value !== undefined && OUTPUT_FORMATS.includes(value as OutputFormat)
}

/** Choose the error channel before strict option validation can fail. */
export function initialOutputFormat(args: string[]): OutputFormat {
  const terminator = args.indexOf('--')
  const optionArgs = terminator < 0 ? args : args.slice(0, terminator)
  if (optionArgs.includes('--json'))
    return 'json'
  if (!READ_COMMANDS.has(optionArgs[0]))
    return 'text'
  const index = optionArgs.findLastIndex(arg => arg === '--format' || arg.startsWith('--format='))
  if (index < 0)
    return 'text'
  const value = optionArgs[index].startsWith('--format=') ? optionArgs[index].slice('--format='.length) : optionArgs[index + 1]
  return isOutputFormat(value) ? value : 'text'
}

function optionValue(args: string[], names: string[]): string | undefined {
  for (let index = args.length - 1; index >= 0; index--) {
    for (const name of names) {
      if (args[index].startsWith(`--${name}=`))
        return args[index].slice(name.length + 3)
      if (args[index] !== `--${name}`)
        continue
      const value = args[index + 1]
      if (value === undefined || value.startsWith('-'))
        throw cliError({ code: 'INVALID_ARGUMENT', message: `--${name} requires a value`, retryable: false })
      return value
    }
  }
  return undefined
}

export function readOutputOptions(args: string[]): { format: OutputFormat, file?: string } {
  const terminator = args.indexOf('--')
  const optionArgs = terminator < 0 ? args : args.slice(0, terminator)
  const json = optionArgs.includes('--json')
  const file = optionValue(optionArgs, ['output-file', 'outputFile'])
  const readCommand = READ_COMMANDS.has(args[0])
  if (file !== undefined && (!readCommand || !file))
    throw cliError({ code: 'INVALID_ARGUMENT', message: '--output-file requires a path and a read command', retryable: false })
  const format = readCommand ? optionValue(optionArgs, ['format']) : undefined
  if (format !== undefined && !isOutputFormat(format))
    throw cliError({ code: 'INVALID_ARGUMENT', message: '--format must be text, json, compact, or jsonl', retryable: false })
  if (json && format !== undefined && format !== 'json')
    throw cliError({ code: 'INVALID_ARGUMENT', message: '--json cannot be combined with a different --format', retryable: false })
  return { format: format ?? (json ? 'json' : file ? 'jsonl' : 'text'), file }
}
