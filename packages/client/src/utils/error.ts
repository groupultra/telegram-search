// Helper to extract error details from RPC error
function parseRpcError(error: unknown): { code?: number, errorMessage?: string } | null {
  if (error && typeof error === 'object' && 'code' in error && 'errorMessage' in error) {
    return {
      code: error.code as number,
      errorMessage: error.errorMessage as string,
    }
  }
  return null
}

/**
 * Get user-friendly error message with i18n support
 * @param error - The error object
 * @param t - The i18n translate function
 */
export function getErrorMessage(error: unknown, t: (key: string, params?: Record<string, unknown>) => string): string {
  const rpcError = parseRpcError(error)

  // Handle Telegram RPC errors
  if (rpcError?.errorMessage) {
    const { errorMessage } = rpcError

    if (errorMessage.startsWith('FLOOD_WAIT_')) {
      const seconds = errorMessage.split('_')[2]
      return t('errors.floodWait', { seconds })
    }

    if (errorMessage === 'TAKEOUT_REQUIRED' || errorMessage.startsWith('TAKEOUT_INIT_DELAY_')) {
      return t('errors.takeoutRequired')
    }

    // Generic RPC error
    return t('errors.rpcError', { message: errorMessage, code: rpcError.code })
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Check for task aborted error
    if (error.message === 'Task aborted') {
      return t('errors.taskAborted')
    }
    return error.message
  }

  return t('errors.unknownError')
}
