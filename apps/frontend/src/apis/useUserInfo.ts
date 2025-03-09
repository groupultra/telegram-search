import type { SuccessResponse, UserInfoResponse } from '@tg-search/server'

import { apiFetch, useApi } from '../composables/api'

/**
 * Vue composable for managing Telegram user info operations
 */
export function useUserInfo() {
  const { loading, error } = useApi()

  /**
   * Get info for a single user by ID
   */
  async function getUserInfo(id: string): Promise<UserInfoResponse> {
    const response = await apiFetch<SuccessResponse<UserInfoResponse>>(`/users/${id}`, {
      method: 'GET',
      query: {
        id,
      },
    })

    return response.data
  }

  /**
   * Get info for multiple users by IDs
   */
  async function getUsersInfo(ids: string[]): Promise<UserInfoResponse[]> {
    const response = await apiFetch<SuccessResponse<UserInfoResponse[]>>('/users/batch', {
      method: 'GET',
      query: { ids },
    })

    return response.data
  }

  return {
    loading,
    error,
    getUserInfo,
    getUsersInfo,
  }
}
