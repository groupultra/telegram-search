import { describe, expect, it } from 'vitest'

import { must0 } from './must'

describe('must', () => {
  describe('must0', () => {
    it('should return first element when array has items', () => {
      const result = must0([1, 2, 3])
      expect(result).toBe(1)
    })

    it('should throw when array is empty', () => {
      expect(() => must0([])).toThrowError('Result is empty')
    })

    it('should return first element when array has one item', () => {
      const result = must0(['only'])
      expect(result).toBe('only')
    })

    it('should work with different types', () => {
      expect(must0(['string'])).toBe('string')
      expect(must0([42])).toBe(42)
      expect(must0([true])).toBe(true)
      expect(must0([{ key: 'value' }])).toEqual({ key: 'value' })
      expect(must0([null])).toBeNull()
    })

    it('should return first element even if it is falsy', () => {
      expect(must0([0])).toBe(0)
      expect(must0([false])).toBe(false)
      expect(must0([''])).toBe('')
    })

    it('should not modify the original array', () => {
      const arr = [1, 2, 3]
      must0(arr)
      expect(arr).toEqual([1, 2, 3])
    })
  })
})
