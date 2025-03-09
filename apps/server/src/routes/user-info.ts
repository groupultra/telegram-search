import type { App, H3Event } from 'h3'
import type { UserInfoResponse } from '../types/apis/user-info'

import { createError, createRouter, defineEventHandler, getRouterParams } from 'h3'

import { useTelegramClient } from '../services/telegram'
import { createResponse } from '../utils/response'

/**
 * Setup user info routes
 */
export function setupUserInfoRoutes(app: App) {
  const router = createRouter()

  // Get single user info
  router.get('/:id', defineEventHandler(async (event: H3Event) => {
    const { id } = getRouterParams(event)
    const client = await useTelegramClient()

    try {
      const userInfo = await client.getUserInfo(id)

      const response: UserInfoResponse = {
        id: userInfo.id.toString(),
        firstName: userInfo?.firstName ?? '',
        lastName: userInfo?.lastName ?? '',
        username: userInfo?.username ?? '',
        // photoUrl: userInfo.photoUrl ?? '',
      }

      return createResponse<UserInfoResponse>(response)
    }
    catch {
      return createError({
        statusCode: 404,
        message: `User ${id} not found`,
      })
    }
  }))

  // Get multiple users info
  router.get('/batch', defineEventHandler(async (event: H3Event) => {
    const { ids } = getRouterParams(event)
    const client = await useTelegramClient()

    if (!ids || !Array.isArray(ids)) {
      throw createError({
        statusCode: 400,
        message: 'User IDs array is required',
      })
    }

    try {
      const usersInfo = await client.getUsersInfo(ids)

      const response: UserInfoResponse[] = usersInfo.map(user => ({
        id: user.id.toString(),
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        username: user?.username ?? '',
        // photoUrl: user.photoUrl ?? '',
      }))

      return createResponse<UserInfoResponse[]>(response)
    }
    catch {
      return createError({
        statusCode: 404,
        message: 'Failed to fetch users info',
      })
    }
  }))

  // Mount routes
  app.use('/users', router.handler)
}
