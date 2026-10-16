import type { AppError, AppResult } from '@tg-search/protocol'

export class ApplicationError extends Error {
  constructor(public readonly appError: AppError) {
    super(appError.message)
    this.name = 'ApplicationError'
  }
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
])

function objectField(error: unknown, field: string): unknown {
  if (typeof error !== 'object' || error === null || !(field in error))
    return undefined
  return error[field as keyof typeof error]
}

function errorMessage(error: unknown): string {
  const message = objectField(error, 'message')
  if (typeof message === 'string' && message)
    return message
  return error instanceof Error && error.message ? error.message : 'Operation failed'
}

function retryAfterSeconds(error: unknown, rpcErrorMessage: string | undefined): { code: string, seconds: number } | undefined {
  const combined = `${rpcErrorMessage ?? ''} ${errorMessage(error)}`
  const takeoutDelay = /TAKEOUT_INIT_DELAY_(\d+)/.exec(combined)
  if (takeoutDelay)
    return { code: 'TAKEOUT_INIT_DELAY', seconds: Number(takeoutDelay[1]) }

  const floodWait = /(?:FLOOD_WAIT|FLOOD_PREMIUM_WAIT|FLOOD_TEST_PHONE_WAIT)_(\d+)/.exec(combined)
  if (floodWait)
    return { code: 'TELEGRAM_FLOOD_WAIT', seconds: Number(floodWait[1]) }

  const friendlyFloodWait = /A wait of (\d+) seconds is required/i.exec(combined)
  if (friendlyFloodWait)
    return { code: 'TELEGRAM_FLOOD_WAIT', seconds: Number(friendlyFloodWait[1]) }
  return undefined
}

function telegramError(error: unknown): AppError | undefined {
  const code = objectField(error, 'code')
  const rpcErrorMessageValue = objectField(error, 'errorMessage')
  const rpcErrorMessage = typeof rpcErrorMessageValue === 'string' ? rpcErrorMessageValue : undefined
  const message = errorMessage(error)
  const retryAfter = retryAfterSeconds(error, rpcErrorMessage)

  if (retryAfter?.code === 'TAKEOUT_INIT_DELAY') {
    return {
      code: 'TAKEOUT_AUTHORIZATION_REQUIRED',
      message: 'Telegram requires user authorization for this data export. Ask the user to review and authorize the export request on one of their Telegram devices, then rerun sync --takeout after Telegram allows it.',
      retryable: false,
      retryAfterSeconds: retryAfter.seconds,
      details: {
        action: 'authorize_takeout_in_telegram',
        telegramError: `TAKEOUT_INIT_DELAY_${retryAfter.seconds}`,
      },
    }
  }

  if (retryAfter) {
    return {
      code: retryAfter.code,
      message,
      retryable: true,
      retryAfterSeconds: retryAfter.seconds,
    }
  }

  const systemCode = typeof code === 'string' ? code : undefined
  const isNetworkFailure = systemCode !== undefined && NETWORK_ERROR_CODES.has(systemCode)
  const isTelegramServerFailure = typeof code === 'number' && code >= 500 && code <= 599
  const isExhaustedGramJsRequest = /Request was unsuccessful \d+ time\(s\)/.test(message)
  if (isNetworkFailure || isTelegramServerFailure || isExhaustedGramJsRequest) {
    return {
      code: 'TELEGRAM_TRANSIENT',
      message,
      retryable: true,
      details: systemCode ? { systemCode } : undefined,
    }
  }

  if (typeof code === 'number' || rpcErrorMessage) {
    return {
      code: 'TELEGRAM_RPC_ERROR',
      message,
      retryable: false,
      details: {
        ...(typeof code === 'number' ? { rpcCode: code } : {}),
        ...(rpcErrorMessage ? { rpcErrorMessage } : {}),
      },
    }
  }

  const cause = objectField(error, 'cause')
  if (cause && cause !== error)
    return telegramError(cause)
  return undefined
}

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
  if (error instanceof ApplicationError)
    return error.appError

  const classifiedTelegramError = telegramError(error)
  if (classifiedTelegramError)
    return classifiedTelegramError

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
