import { describe, expect, it } from 'vitest'

import { isBrowser } from './is-browser'

describe('is-browser', () => {
  describe('isBrowser', () => {
    it('should return false in Node.js environment', () => {
      // In vitest/Node.js environment, window is not defined
      expect(isBrowser()).toBe(false)
    })

    it('should return true when window is defined', () => {
      // Simulate browser environment by defining window
      const originalWindow = (globalThis as any).window
      ;(globalThis as any).window = {}

      expect(isBrowser()).toBe(true)

      // Restore original state
      if (originalWindow === undefined) {
        delete (globalThis as any).window
      }
      else {
        (globalThis as any).window = originalWindow
      }
    })
  })
})
