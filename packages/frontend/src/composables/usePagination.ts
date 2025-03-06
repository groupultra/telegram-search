import { computed, ref } from 'vue'

export interface PaginationOptions {
  defaultPage?: number
  defaultPageSize?: number
  defaultTotal?: number
}

export function usePagination(options: PaginationOptions = {}) {
  const currentPage = ref(options.defaultPage || 1)
  const pageSize = ref(options.defaultPageSize || 10)
  const total = ref(options.defaultTotal || 0)

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

  const paginatedData = <T>(data: T[]) => {
    const startIndex = (currentPage.value - 1) * pageSize.value
    const endIndex = startIndex + pageSize.value
    return data.slice(startIndex, endIndex)
  }

  const setPage = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages.value)
      currentPage.value = newPage
  }

  const setPageSize = (newSize: number) => {
    if (newSize > 0) {
      pageSize.value = newSize
      // Reset to first page when changing page size
      currentPage.value = 1
    }
  }

  const setTotal = (newTotal: number) => {
    total.value = newTotal
    // Adjust current page if it exceeds new total pages
    if (currentPage.value > totalPages.value)
      currentPage.value = totalPages.value
  }

  return {
    currentPage,
    pageSize,
    total,
    totalPages,
    paginatedData,
    setPage,
    setPageSize,
    setTotal,
  }
}
