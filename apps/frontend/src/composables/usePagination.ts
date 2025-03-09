import { computed, ref } from 'vue'

export interface PaginationOptions {
  defaultPage?: number
  defaultPageSize?: number
  defaultTotal?: number
}

export function usePagination(options: PaginationOptions = {}) {
  const currentPage = ref(options.defaultPage || 1)
  const pageSize = ref(options.defaultPageSize || 10)

  const paginatedData = <T>(data: T[]) => {
    const startIndex = (currentPage.value - 1) * pageSize.value
    const endIndex = startIndex + pageSize.value
    return data.slice(startIndex, endIndex)
  }

  const totalPages = computed(() => {
    return (data: unknown[]) => Math.ceil(data.length / pageSize.value)
  })

  const setPage = (newPage: number) => {
    if (newPage > 0)
      currentPage.value = newPage
  }

  const setPageSize = (newSize: number) => {
    if (newSize > 0) {
      pageSize.value = newSize
      // Reset to first page when changing page size
      currentPage.value = 1
    }
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    paginatedData,
    setPage,
    setPageSize,
  }
}
