import type { AppError, AppResult } from '@tg-search/protocol'

export function invalidArgument(message: string, details?: Record<string, unknown>): Extract<AppResult<never>, { ok: false }> {
  return {
    ok: false,
    error: {
      code: 'INVALID_ARGUMENT',
      message,
      retryable: false,
      details,
    },
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof Error) {
    return {
      code: 'INTERNAL',
      message: error.message || 'Operation failed',
      retryable: false,
    }
  }

  return {
    code: 'INTERNAL',
    message: 'Operation failed',
    retryable: false,
  }
}

export async function appResult<T>(operation: () => Promise<T>): Promise<AppResult<T>> {
  try {
    return { ok: true, data: await operation() }
  }
  catch (error) {
    return { ok: false, error: toAppError(error) }
  }
}
