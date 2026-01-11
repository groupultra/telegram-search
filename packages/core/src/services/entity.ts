import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'

import bigInt from 'big-integer'

import { Api } from 'telegram'

import { useAvatarHelper } from '../message-resolvers/avatar-resolver'
import { chatModels } from '../models/chats'
import { userModels } from '../models/users'
import { resolveEntity } from '../utils/entity'

export type EntityService = ReturnType<typeof createEntityService>

export function createEntityService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:entity:service')

  /**
   * Delegate avatar fetching to centralized AvatarHelper to avoid duplication.
   * Keeps caches and in-flight dedup at resolver-level per context.
   */
  const avatarHelper = useAvatarHelper(ctx, logger)

  async function getEntity(uid: string) {
    logger.withFields({ uid }).debug('Getting entity')

    const user = await ctx.getClient().getEntity(uid)
    return user
  }

  /**
   * Get InputPeer for a given peer ID, prioritizing DB access_hash over GramJS cache.
   * Handles BigInt conversion and entity type resolution.
   */
  async function getInputPeer(peerId: string | number): Promise<Api.TypeInputPeer> {
    // If it's "me", return InputPeerSelf
    // Note: GramJS usually handles 'me' or 'self' string, but if we pass the actual ID of 'me',
    // we should detect it if possible. For now, rely on explicit 'me' check or fallback.
    if (peerId === 'me' || peerId === 'self') {
      return new Api.InputPeerSelf()
    }

    const idStr = peerId.toString()
    const accountId = ctx.getCurrentAccountId()

    // 1. Try to find in account-joined chats (Dialogs)
    if (accountId) {
      const chatRes = await chatModels.findChatAccessHash(ctx.getDB(), accountId, idStr)
      // Safely unwrap or default to null if error (though findChatAccessHash shouldn't return Err for not found, it returns Ok(null))
      // If it returns Err (DB error), we log and skip.
      let chatValue
      try {
        chatValue = chatRes.unwrap()
      }
      catch (e) {
        logger.withError(e).warn('Failed to unwrap chat access hash result')
      }

      if (chatValue) {
        const { accessHash, type } = chatValue
        const id = bigInt(idStr)
        const hash = bigInt(accessHash)

        if (type === 'user' || type === 'bot') {
          return new Api.InputPeerUser({ userId: id, accessHash: hash })
        }
        if (type === 'channel' || type === 'supergroup') {
          return new Api.InputPeerChannel({ channelId: id, accessHash: hash })
        }
        if (type === 'group') {
          return new Api.InputPeerChat({ chatId: id })
        }
      }
    }

    // 2. Try to find in global users cache
    const userHashRes = await userModels.findUserAccessHash(ctx.getDB(), idStr)
    let userHashValue
    try {
      userHashValue = userHashRes.unwrap()
    }
    catch (e) {
      logger.withError(e).warn('Failed to unwrap user access hash result')
    }

    if (userHashValue) {
      return new Api.InputPeerUser({
        userId: bigInt(idStr),
        accessHash: bigInt(userHashValue),
      })
    }

    // 3. Fallback to GramJS client cache / network
    logger.withFields({ peerId }).debug('InputPeer not found in DB, falling back to client')
    return ctx.getClient().getInputEntity(peerId)
  }

  /**
   * Process and persist entities from GramJS updates.
   * This ensures we have the latest accessHash for users and chats.
   */
  async function processEntities(users: Api.TypeUser[], chats: Api.TypeChat[]) {
    logger.withFields({ users: users.length, chats: chats.length }).debug('Processing entities')
    const db = ctx.getDB()

    // Process Users
    for (const user of users) {
      if (user instanceof Api.User) {
        try {
          const resolved = resolveEntity(user).unwrap()
          await userModels.recordUser(db, resolved)
        }
        catch (e) {
          logger.withError(e).warn('Failed to resolve user entity')
        }
      }
    }

    // Process Chats/Channels
    for (const chat of chats) {
      if (chat instanceof Api.Chat || chat instanceof Api.Channel) {
        try {
          const resolved = resolveEntity(chat).unwrap()
          if (resolved.type !== 'user') {
            await chatModels.recordChatEntity(db, resolved, ctx.getCurrentAccountId())
          }
        }
        catch (e) {
          logger.withError(e).warn('Failed to resolve chat entity')
        }
      }
    }
  }

  /**
   * Fetch a user's avatar via centralized AvatarHelper.
   * Ensures consistent caching and deduplication across services.
   * Optional expectedFileId allows cache validation before fetching.
   */
  async function fetchUserAvatar(userId: string, expectedFileId?: string) {
    await avatarHelper.fetchUserAvatar(userId, expectedFileId)
  }

  /**
   * Prime the avatar LRU cache with fileId information from frontend IndexedDB.
   * This allows subsequent fetchUserAvatar calls to hit cache without entity fetch.
   */
  async function primeUserAvatarCache(userId: string, fileId: string) {
    avatarHelper.primeUserAvatarCache(userId, fileId)
  }

  /**
   * Prime the chat avatar LRU cache with fileId information from frontend IndexedDB.
   * This allows subsequent fetchDialogAvatar calls to hit cache without entity fetch.
   */
  async function primeChatAvatarCache(chatId: string, fileId: string) {
    avatarHelper.primeChatAvatarCache(chatId, fileId)
  }

  return {
    getEntity,
    getInputPeer,
    processEntities,
    fetchUserAvatar,
    primeUserAvatarCache,
    primeChatAvatarCache,
  }
}
