import { describe, expect, it } from 'vitest'

import { initLogger, useLogger } from './logger'

describe('logger', () => {
  describe('initLogger', () => {
    it('should initialize logger without error', () => {
      expect(() => initLogger()).not.toThrow()
    })
  })

  describe('useLogger', () => {
    it('should create logger with provided name', () => {
      const logger = useLogger('test')
      expect(logger).toBeDefined()
      expect(logger.log).toBeInstanceOf(Function)
      expect(logger.debug).toBeInstanceOf(Function)
      expect(logger.warn).toBeInstanceOf(Function)
      expect(logger.error).toBeInstanceOf(Function)
      expect(logger.withFields).toBeInstanceOf(Function)
      expect(logger.withError).toBeInstanceOf(Function)
    })

    it('should create logger with auto-detected name', () => {
      const logger = useLogger()
      expect(logger).toBeDefined()
    })

    it('should log message with fields', () => {
      const logger = useLogger('test')
      expect(() => {
        logger.log('test message', { field: 'value' })
        logger.debug('test message', { field: 'value' })
        logger.warn('test message', { field: 'value' })
        logger.withError(new Error('test error')).error('test message')
      }).not.toThrow()
    })

    it('should log message without fields', () => {
      const logger = useLogger('test')
      expect(() => {
        logger.log('test message')
        logger.debug('test message')
        logger.warn('test message')
        logger.error('test message')
      }).not.toThrow()
    })

    it('should chain withFields and withError', () => {
      const logger = useLogger('test')
      const error = new Error('test error')

      expect(() => {
        logger.withFields({ field: 'value' }).log('test message')
        logger.withError(error).error('test message')
      }).not.toThrow()
    })
  })
})
