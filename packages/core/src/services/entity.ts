import type { Result } from '@unbird/result'

import type { CoreContext } from '../context'
import type { CoreUserEntity } from '../types/events'

import { Ok } from '@unbird/result'

import { useAvatarHelper } from '../message-resolvers/avatar-resolver'
import { resolveEntity } from '../utils/entity'

export type EntityService = ReturnType<typeof createEntityService>

export function createEntityService(ctx: CoreContext) {
  const { getClient, emitter } = ctx

  /**
   * Delegate avatar fetching to centralized AvatarHelper to avoid duplication.
   * Keeps caches and in-flight dedup at resolver-level per context.
   */
  const avatarHelper = useAvatarHelper(ctx)

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

  /**
   * Fetch a user's avatar via centralized AvatarHelper.
   * Ensures consistent caching and deduplication across services.
   */
  async function fetchUserAvatar(userId: string) {
    await avatarHelper.fetchUserAvatar(userId)
  }

  return {
    getEntity,
    getMeInfo,
    fetchUserAvatar,
  }
}
