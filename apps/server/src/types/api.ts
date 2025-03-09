/**
 * Base response interface for all API responses
 */
export interface BaseResponse {
  success: boolean
  timestamp: string
  code?: string
  message?: string
}

/**
 * Success response with generic data type and optional pagination
 */
export type SuccessResponse<T> = BaseResponse & {
  success: true
  data: T
  pagination?: PaginationInfo
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = 'API_ERROR',
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = code
  }
}

/**
 * Pagination information structure
 */
export interface PaginationInfo {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Error response with error details
 */
export type ErrorResponse = BaseResponse & {
  success: false
  error: string
  code: string
  details?: Record<string, unknown>
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

/**
 * Common pagination parameters
 */
export interface PaginationParams {
  limit?: number
  offset?: number
}

/**
 * Generic paginated response structure
 */
export interface PaginatedResponse<T> {
  total: number
  items: T[]
}
