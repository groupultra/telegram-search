import type { AppError } from '@tg-search/protocol'

import { appErrorSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

export function cliError(error: AppError): Error & { appError: AppError } {
  return Object.assign(new Error(error.message), { appError: error })
}

export function toCliError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'appError' in error) {
    const result = safeParse(appErrorSchema, error.appError)
    if (result.success)
      return result.output
  }
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  const message = error instanceof Error ? error.message : 'CLI operation failed'
  if (code === 'EARG' || code === 'E_NO_COMMAND')
    return { code: 'INVALID_ARGUMENT', message, retryable: false }
  if (code === 'E_UNKNOWN_COMMAND')
    return { code: 'UNKNOWN_COMMAND', message, retryable: false }
  if (code === 'EACCES' || code === 'EPERM')
    return { code: 'FILE_ACCESS_DENIED', message: 'Access to a requested local file was denied', retryable: false }
  return { code: 'CLI_ERROR', message, retryable: false }
}
