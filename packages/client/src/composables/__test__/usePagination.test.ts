import { describe, expect, it } from 'vitest'

import { usePagination } from '../usePagination'

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const pagination = usePagination()

    expect(pagination.currentPage.value).toBe(1)
    expect(pagination.pageSize.value).toBe(10)
  })

  it('should initialize with custom values', () => {
    const pagination = usePagination({
      defaultPage: 3,
      defaultPageSize: 20,
    })

    expect(pagination.currentPage.value).toBe(3)
    expect(pagination.pageSize.value).toBe(20)
  })

  it('should paginate data correctly', () => {
    const pagination = usePagination({ defaultPageSize: 3 })
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const page1 = pagination.paginatedData(data)
    expect(page1).toEqual([1, 2, 3])

    pagination.setPage(2)
    const page2 = pagination.paginatedData(data)
    expect(page2).toEqual([4, 5, 6])

    pagination.setPage(3)
    const page3 = pagination.paginatedData(data)
    expect(page3).toEqual([7, 8, 9])

    pagination.setPage(4)
    const page4 = pagination.paginatedData(data)
    expect(page4).toEqual([10])
  })

  it('should calculate total pages correctly', () => {
    const pagination = usePagination({ defaultPageSize: 3 })
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    expect(pagination.totalPages.value(data)).toBe(4)

    pagination.setPageSize(5)
    expect(pagination.totalPages.value(data)).toBe(2)

    pagination.setPageSize(10)
    expect(pagination.totalPages.value(data)).toBe(1)
  })

  it('should handle empty data', () => {
    const pagination = usePagination()
    const data: number[] = []

    expect(pagination.paginatedData(data)).toEqual([])
    expect(pagination.totalPages.value(data)).toBe(0)
  })

  it('should handle single page data', () => {
    const pagination = usePagination({ defaultPageSize: 10 })
    const data = [1, 2, 3]

    expect(pagination.paginatedData(data)).toEqual([1, 2, 3])
    expect(pagination.totalPages.value(data)).toBe(1)
  })

  it('should not set page to invalid values', () => {
    const pagination = usePagination()

    pagination.setPage(5)
    expect(pagination.currentPage.value).toBe(5)

    // Try to set negative page
    pagination.setPage(-1)
    expect(pagination.currentPage.value).toBe(5) // Should remain unchanged

    // Try to set zero page
    pagination.setPage(0)
    expect(pagination.currentPage.value).toBe(5) // Should remain unchanged
  })

  it('should not set page size to invalid values', () => {
    const pagination = usePagination()

    pagination.setPageSize(20)
    expect(pagination.pageSize.value).toBe(20)

    // Try to set negative page size
    pagination.setPageSize(-1)
    expect(pagination.pageSize.value).toBe(20) // Should remain unchanged

    // Try to set zero page size
    pagination.setPageSize(0)
    expect(pagination.pageSize.value).toBe(20) // Should remain unchanged
  })

  it('should reset to first page when changing page size', () => {
    const pagination = usePagination()

    pagination.setPage(5)
    expect(pagination.currentPage.value).toBe(5)

    pagination.setPageSize(20)
    expect(pagination.currentPage.value).toBe(1)
    expect(pagination.pageSize.value).toBe(20)
  })

  it('should handle partial last page', () => {
    const pagination = usePagination({ defaultPageSize: 4 })
    const data = [1, 2, 3, 4, 5, 6, 7]

    pagination.setPage(2)
    const lastPage = pagination.paginatedData(data)
    expect(lastPage).toEqual([5, 6, 7])
  })

  it('should handle data larger than current page', () => {
    const pagination = usePagination({ defaultPageSize: 5 })
    const data = [1, 2, 3]

    pagination.setPage(2)
    const result = pagination.paginatedData(data)
    expect(result).toEqual([]) // No data on page 2
  })

  it('should work with different data types', () => {
    const pagination = usePagination({ defaultPageSize: 2 })

    const strings = ['a', 'b', 'c', 'd']
    expect(pagination.paginatedData(strings)).toEqual(['a', 'b'])

    const objects = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(pagination.paginatedData(objects)).toEqual([{ id: 1 }, { id: 2 }])
  })
})
