import { describe, expect, it } from 'vitest'

import { usePagination } from './pagination'

describe('pagination', () => {
  describe('usePagination', () => {
    it('should return pagination object with default values', () => {
      const pagination = usePagination()

      expect(pagination).toEqual({
        offset: 0,
        limit: 100,
      })
    })

    it('should return new object on each call', () => {
      const pagination1 = usePagination()
      const pagination2 = usePagination()

      expect(pagination1).not.toBe(pagination2)
      expect(pagination1).toEqual(pagination2)
    })

    it('should allow modification of returned pagination object', () => {
      const pagination = usePagination()

      pagination.offset = 50
      pagination.limit = 25

      expect(pagination.offset).toBe(50)
      expect(pagination.limit).toBe(25)
    })
  })
})
