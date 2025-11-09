/* eslint-disable unicorn/prefer-node-protocol */
import type { Result } from '@unbird/result'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'

import { Buffer } from 'buffer'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'
import { Api } from 'telegram'

/**
 * Shared avatar cache entry.
 * Stores last `fileId`, `mimeType`, and raw `byte` for reuse.
 */
interface AvatarCacheEntry {
  fileId?: string
  mimeType?: string
  byte?: Buffer
  updatedAt?: number
}

/**
 * Per-context singleton store for avatar helper to avoid duplicated instances.
 */
const __avatarHelperSingleton = new WeakMap<CoreContext, ReturnType<typeof createAvatarHelper>>()

/**
 * Create shared avatar helper bound to a CoreContext.
 * Encapsulates caches and in-flight deduplication for users and dialogs.
 */
function createAvatarHelper(ctx: CoreContext) {
  const logger = useLogger('core:resolver:avatar')
  const { getClient, emitter } = ctx

  // In-memory caches
  const userAvatarCache = new Map<string, AvatarCacheEntry>()
  const chatAvatarCache = new Map<number, AvatarCacheEntry>()
  const dialogEntityCache = new Map<number, Api.User | Api.Chat | Api.Channel>()

  // In-flight dedup sets
  const inflightUsers = new Set<string>()
  const inflightChats = new Set<number>()

  /**
   * Resolve avatar fileId for a Telegram entity.
   * Returns undefined if no photo is present.
   */
  function resolveAvatarFileId(entity: Api.User | Api.Chat | Api.Channel | undefined): string | undefined {
    try {
      if (!entity)
        return undefined

      if (entity instanceof Api.User && entity.photo && 'photoId' in entity.photo) {
        return (entity.photo as Api.UserProfilePhoto).photoId?.toString()
      }
      else if ((entity instanceof Api.Chat || entity instanceof Api.Channel) && entity.photo && 'photoId' in entity.photo) {
        return (entity.photo as Api.ChatPhoto).photoId?.toString()
      }
    }
    catch {}
    return undefined
  }

  /**
   * Download small profile photo for the given entity.
   * Falls back to `downloadMedia` when `downloadProfilePhoto` fails.
   */
  async function downloadSmallAvatar(entity: Api.User | Api.Chat | Api.Channel): Promise<Buffer | undefined> {
    let buffer: Buffer | Uint8Array | undefined
    try {
      buffer = await getClient().downloadProfilePhoto(entity, { isBig: false }) as Buffer
    }
    catch (err) {
      logger.withError(err as Error).debug('downloadProfilePhoto failed, trying fallback')
      const photo = (entity as any).photo
      if (photo) {
        try {
          buffer = await getClient().downloadMedia(photo, { thumb: -1 }) as Buffer
        }
        catch (err2) {
          logger.withError(err2 as Error).debug('downloadMedia fallback failed')
        }
      }
    }

    if (!buffer)
      return undefined

    // Ensure Buffer for JSON-safe serialization
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  }

  /**
   * Fetch and emit a user's avatar bytes, with cache and in-flight dedup.
   * Emits `entity:avatar:data` on success.
   */
  async function fetchUserAvatar(userId: string): Promise<void> {
    try {
      const key = String(Number(userId) || userId)
      if (inflightUsers.has(key))
        return
      inflightUsers.add(key)

      const entity = await getClient().getEntity(userId) as Api.User
      const fileId = resolveAvatarFileId(entity)

      const cached = userAvatarCache.get(key)
      if (cached && cached.fileId && fileId && cached.fileId === fileId) {
        logger.withFields({ userId: key }).verbose('User avatar cache hit')
        if (cached.byte && cached.mimeType) {
          emitter.emit('entity:avatar:data', { userId: key, byte: cached.byte, mimeType: cached.mimeType, fileId })
        }
        return
      }

      const byte = entity ? await downloadSmallAvatar(entity) : undefined
      if (!byte) {
        logger.withFields({ userId: key }).verbose('No avatar available for user')
        return
      }

      const mimeType = 'image/jpeg'
      userAvatarCache.set(key, { fileId, mimeType, byte, updatedAt: Date.now() })
      emitter.emit('entity:avatar:data', { userId: key, byte, mimeType, fileId })
    }
    catch (error) {
      logger.withError(error as Error).warn('Failed to fetch avatar for user')
    }
    finally {
      inflightUsers.delete(String(Number(userId) || userId))
    }
  }

  /**
   * Fetch and emit a single dialog avatar bytes, with cache and in-flight dedup.
   * Emits `dialog:avatar:data` on success.
   */
  async function fetchDialogAvatar(chatId: string | number, opts: { entityOverride?: Api.User | Api.Chat | Api.Channel } = {}): Promise<void> {
    try {
      const idNum = typeof chatId === 'string' ? Number(chatId) : chatId
      if (!idNum)
        return

      if (inflightChats.has(idNum))
        return
      inflightChats.add(idNum)

      let entity = opts.entityOverride ?? dialogEntityCache.get(idNum)
      if (!entity) {
        entity = await getClient().getEntity(String(chatId)) as Api.User | Api.Chat | Api.Channel
        // Cache entity for future single fetches
        try {
          if (entity && (entity as any).id?.toJSNumber)
            dialogEntityCache.set((entity as any).id.toJSNumber(), entity)
        }
        catch {}
      }
      if (!entity)
        return

      const fileId = resolveAvatarFileId(entity)
      const cached = chatAvatarCache.get(idNum)
      if (cached && cached.fileId && fileId && cached.fileId === fileId) {
        logger.withFields({ chatId: idNum }).verbose('Single avatar cache hit; skip emit')
        return
      }

      const byte = await downloadSmallAvatar(entity)
      if (!byte) {
        logger.withFields({ chatId: idNum }).verbose('No avatar available for single dialog fetch')
        return
      }

      const mimeType = 'image/jpeg'
      chatAvatarCache.set(idNum, { fileId, mimeType, byte, updatedAt: Date.now() })
      emitter.emit('dialog:avatar:data', { chatId: idNum, byte, mimeType, fileId })
    }
    catch (error) {
      logger.withError(error as Error).warn('Failed to fetch single avatar for dialog')
    }
    finally {
      try {
        const id = typeof chatId === 'string' ? Number(chatId) : chatId
        if (id)
          inflightChats.delete(id as number)
      }
      catch {}
    }
  }

  /**
   * Batch fetch avatars for a list of dialogs with concurrency.
   * Emits incremental `dialog:avatar:data` events as each item completes.
   */
  async function fetchDialogAvatars(dialogList: Dialog[], concurrency = 12): Promise<void> {
    const total = dialogList.length
    if (total === 0)
      return

    async function worker() {
      while (dialogList.length > 0) {
        const dialog = dialogList.shift()!
        if (!dialog?.entity)
          continue

        try {
          const id = dialog.entity.id?.toJSNumber?.()
          if (!id)
            continue

          const fileId = resolveAvatarFileId(dialog.entity as Api.User | Api.Chat | Api.Channel)

          const cached = chatAvatarCache.get(id)
          // If cache exists and fileId unchanged, skip network and emit to reduce noise.
          if (cached && cached.fileId && fileId && cached.fileId === fileId) {
            logger.withFields({ chatId: id }).verbose('Avatar cache hit; skip emit')
            continue
          }

          const byte = await downloadSmallAvatar(dialog.entity as Api.User | Api.Chat | Api.Channel)
          if (!byte) {
            logger.withFields({ chatId: id }).verbose('No avatar available for dialog')
            continue
          }

          const mimeType = 'image/jpeg'
          chatAvatarCache.set(id, { fileId, mimeType, byte, updatedAt: Date.now() })
          emitter.emit('dialog:avatar:data', { chatId: id, byte, mimeType, fileId })
        }
        catch (error) {
          logger.withError(error as Error).warn('Failed to fetch avatar for dialog')
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker())
    await Promise.allSettled(workers)
  }

  return {
    fetchUserAvatar,
    fetchDialogAvatar,
    fetchDialogAvatars,
    dialogEntityCache,
  }
}

/**
 * Get or create a shared avatar helper instance bound to the provided context.
 */
export function useAvatarHelper(ctx: CoreContext) {
  let helper = __avatarHelperSingleton.get(ctx)
  if (!helper) {
    helper = createAvatarHelper(ctx)
    __avatarHelperSingleton.set(ctx, helper)
  }
  return helper
}

/**
 * Create AvatarResolver for message pipeline.
 * For each message, opportunistically fetch sender's avatar and emit bytes.
 * Returns no message mutations (Ok([])) to avoid duplicate storage writes.
 */
export function createAvatarResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:avatar')
  const helper = useAvatarHelper(ctx)

  return {
    /**
     * Process messages and ensure user avatars are fetched lazily.
     */
    run: async (opts: MessageResolverOpts): Promise<Result<never[]>> => {
      logger.verbose('Executing avatar resolver')

      // Deduplicate by sender id to avoid repeated downloads within the same batch
      const uniqueUserIds = Array.from(new Set(opts.messages.map(m => String(m.fromId)).filter(Boolean)))

      await Promise.all(uniqueUserIds.map(id => helper.fetchUserAvatar(id)))

      // No message mutations to persist
      return Ok([] as never[])
    },
  }
}
