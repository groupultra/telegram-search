import { describe, expect, it } from 'vitest'

import { getErrorMessage } from './error'

describe('error', () => {
  // Mock translate function
  const mockT = (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'errors.floodWait': `Please wait ${params?.seconds} seconds before trying again`,
      'errors.takeoutRequired': 'Takeout session required',
      'errors.rpcError': `RPC Error (${params?.code}): ${params?.message}`,
      'errors.taskAborted': 'Task was aborted',
      'errors.unknownError': 'An unknown error occurred',
    }
    return translations[key] || key
  }

  describe('getErrorMessage', () => {
    it('should handle FLOOD_WAIT error', () => {
      const error = {
        code: 420,
        errorMessage: 'FLOOD_WAIT_60',
      }

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('Please wait 60 seconds before trying again')
    })

    it('should handle TAKEOUT_REQUIRED error', () => {
      const error = {
        code: 400,
        errorMessage: 'TAKEOUT_REQUIRED',
      }

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('Takeout session required')
    })

    it('should handle TAKEOUT_INIT_DELAY error', () => {
      const error = {
        code: 400,
        errorMessage: 'TAKEOUT_INIT_DELAY_60',
      }

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('Takeout session required')
    })

    it('should handle generic RPC error', () => {
      const error = {
        code: 500,
        errorMessage: 'INTERNAL_SERVER_ERROR',
      }

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('RPC Error (500): INTERNAL_SERVER_ERROR')
    })

    it('should handle Error instance', () => {
      const error = new Error('Network connection failed')

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('Network connection failed')
    })

    it('should handle Task aborted error', () => {
      const error = new Error('Task aborted')

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('Task was aborted')
    })

    it('should handle unknown error types', () => {
      const error = 'some string error'

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('An unknown error occurred')
    })

    it('should handle null error', () => {
      const result = getErrorMessage(null, mockT)
      expect(result).toBe('An unknown error occurred')
    })

    it('should handle undefined error', () => {
      const result = getErrorMessage(undefined, mockT)
      expect(result).toBe('An unknown error occurred')
    })

    it('should handle RPC error without code as unknown error', () => {
      const error = {
        errorMessage: 'SOME_ERROR',
        // Missing 'code' property, so parseRpcError returns null
      }

      const result = getErrorMessage(error, mockT)
      // Without both code and errorMessage, it's treated as unknown
      expect(result).toBe('An unknown error occurred')
    })

    it('should handle object that is not an RPC error', () => {
      const error = {
        message: 'Not an RPC error',
        someOtherProp: 'value',
      }

      const result = getErrorMessage(error, mockT)
      expect(result).toBe('An unknown error occurred')
    })

    it('should parse FLOOD_WAIT with different wait times', () => {
      const error1 = { code: 420, errorMessage: 'FLOOD_WAIT_30' }
      const error2 = { code: 420, errorMessage: 'FLOOD_WAIT_3600' }

      expect(getErrorMessage(error1, mockT)).toBe('Please wait 30 seconds before trying again')
      expect(getErrorMessage(error2, mockT)).toBe('Please wait 3600 seconds before trying again')
    })
  })
})
