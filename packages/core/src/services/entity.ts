import type { Result } from '@tg-search/result'

import type { CoreContext } from '../context'

import { Ok } from '@tg-search/result'

import { resolveEntity } from '../utils/entity'

export interface CoreBaseEntity {
  id: string
  name: string
}

export interface CoreUserEntity extends CoreBaseEntity {
  type: 'user'
  username: string
}

export interface CoreChatEntity extends CoreBaseEntity {
  type: 'chat'
}

export interface CoreChannelEntity extends CoreBaseEntity {
  type: 'channel'
}

export type CoreEntity = CoreUserEntity | CoreChatEntity | CoreChannelEntity

export interface EntityEventToCore {
  'entity:me:fetch': () => void
}

export interface EntityEventFromCore {
  'entity:me:data': (data: CoreUserEntity) => void
}

export type EntityEvent = EntityEventFromCore & EntityEventToCore

export type EntityService = ReturnType<typeof createEntityService>

export function createEntityService(ctx: CoreContext) {
  const { getClient, emitter } = ctx

  async function getEntity(uid: string) {
    const user = await getClient().getEntity(uid)
    return user
  }

  async function getMeInfo(): Promise<Result<CoreUserEntity>> {
    const apiUser = await getClient().getMe()
    const result = resolveEntity(apiUser).expect('Failed to resolve entity') as CoreUserEntity
    emitter.emit('entity:me:data', result)
    return Ok(result)
  }

  return {
    getEntity,
    getMeInfo,
  }
}
