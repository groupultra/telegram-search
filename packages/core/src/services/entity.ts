import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { withResult } from '../utils/result'

export interface CoreUserInfo {
  id: string
  firstName: string
  lastName: string
  username: string
  photoUrl?: string
}

export interface EntityEventToCore {
  'entity:getMe': () => void
}

export interface EntityEventFromCore {
  'entity:me': (data: CoreUserInfo) => void
}

export type EntityEvent = EntityEventFromCore & EntityEventToCore

export function createEntityService(ctx: CoreContext) {
  const { getClient, emitter } = ctx

  async function getEntity(uid: string) {
    const user = await getClient().getEntity(uid)
    return user
  }

  async function getMeInfo(): PromiseResult<CoreUserInfo> {
    const apiUser = await getClient().getMe()

    const user = {
      id: apiUser.id.toString(),
      firstName: apiUser.firstName ?? '',
      lastName: apiUser.lastName ?? '',
      username: apiUser.username ?? '',
      // photoUrl: apiUser.photo?.url,
    }

    emitter.emit('entity:me', user)

    return withResult(user, null)
  }

  return {
    getEntity,
    getMeInfo,
  }
}
