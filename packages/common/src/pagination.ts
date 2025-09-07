export interface CorePagination {
  offset: number
  limit: number
}

export function usePagination() {
  const pagination = {
    offset: 0,
    limit: 100,
  }

  return pagination
}
