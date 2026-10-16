import type { OutputFormat } from './output'

import { cliError } from './cli-errors'

export const readOutputArgs = {
  format: { type: 'string' as const, description: 'Output format: text, json, compact, or jsonl' },
  outputFile: { type: 'string' as const, description: 'Write this result to a new private file (defaults to JSONL)' },
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
  const readCommand = ['chats', 'messages', 'media', 'search', 'context', 'stats'].includes(args[0])
  if (file !== undefined && (!readCommand || !file))
    throw cliError({ code: 'INVALID_ARGUMENT', message: '--output-file requires a path and a read command', retryable: false })
  const format = readCommand ? optionValue(optionArgs, ['format']) : undefined
  if (format !== undefined && !['text', 'json', 'compact', 'jsonl'].includes(format))
    throw cliError({ code: 'INVALID_ARGUMENT', message: '--format must be text, json, compact, or jsonl', retryable: false })
  if (json && format !== undefined && format !== 'json')
    throw cliError({ code: 'INVALID_ARGUMENT', message: '--json cannot be combined with a different --format', retryable: false })
  return { format: (format as OutputFormat | undefined) ?? (json ? 'json' : file ? 'jsonl' : 'text'), file }
}
