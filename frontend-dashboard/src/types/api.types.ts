export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiSuccessResponse<T = unknown> {
  data: T
  message?: string
}

export interface ApiErrorResponse {
  message: string | string[]
  statusCode: number
  error?: string
}

// Common entity fields
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}
