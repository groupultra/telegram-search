import type { Api } from 'telegram'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { CoreMessageMediaFromServer } from '../types/media'
import type { CoreMessage } from '../types/message'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { useLogger } from '@guiiai/logg'
import { newQueue } from '@henrygd/queue'
import { fileTypeFromBuffer } from 'file-type'

import { MEDIA_DOWNLOAD_CONCURRENCY } from '../constants'
import { useDrizzle } from '../db'
import { findPhotoByFileId, getPhotoQueryIdByFileId, getStickerQueryIdByFileId } from '../models'

export function createMediaResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:media')
  // Create concurrency limit queue
  const downloadQueue = newQueue(MEDIA_DOWNLOAD_CONCURRENCY)

  return {
    async* stream(opts: MessageResolverOpts) {
      logger.verbose('Executing media resolver')

      for (const message of opts.messages) {
        if (!message.media || message.media.length === 0) {
          continue
        }

        // Use concurrency limit queue to avoid downloading too many files simultaneously
        const mediaPromises = message.media.map(media =>
          downloadQueue.add(async () => {
            logger.withFields({ media }).debug('Media')

            // Stickers: prefer existing DB row -> queryId, otherwise download & store via storage pipeline.
            if (media.type === 'sticker') {
              const db = useDrizzle()
              try {
                const queryId = (await getStickerQueryIdByFileId(db, media.platformId)).orUndefined() as string | undefined

                if (queryId) {
                  return {
                    messageUUID: message.uuid,
                    queryId,
                    type: media.type,
                    platformId: media.platformId,
                  } satisfies CoreMessageMediaFromServer
                }
              }
              catch (error) {
                logger.withError(error).debug('Failed to resolve sticker from cache, falling back to download')
              }
            }

            // Photos: prefer existing DB row -> queryId + optional mimeType, otherwise download.
            if (media.type === 'photo') {
              const db = useDrizzle()
              try {
                const photo = (await findPhotoByFileId(db, media.platformId)).orUndefined()
                if (photo && photo.id) {
                  const cachedBytes = photo.image_bytes
                  const mimeType = cachedBytes ? (await fileTypeFromBuffer(cachedBytes))?.mime : undefined

                  return {
                    messageUUID: message.uuid,
                    queryId: photo.id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                  } satisfies CoreMessageMediaFromServer
                }
              }
              catch (error) {
                logger.withError(error).debug('Failed to resolve photo from cache, falling back to download')
              }

              // As a secondary fast path, try to resolve just the queryId without loading bytes.
              try {
                const queryId = (await getPhotoQueryIdByFileId(db, media.platformId)).orUndefined() as string | undefined
                if (queryId) {
                  return {
                    messageUUID: message.uuid,
                    queryId,
                    type: media.type,
                    platformId: media.platformId,
                  } satisfies CoreMessageMediaFromServer
                }
              }
              catch (error) {
                logger.withError(error).debug('Failed to resolve photo queryId from cache, falling back to download')
              }
            }

            // Fallback: download media from Telegram.
            const mediaFetched = await ctx.getClient().downloadMedia(media.apiMedia as Api.TypeMessageMedia)
            const byte = mediaFetched instanceof Buffer ? mediaFetched : undefined

            if (!byte) {
              logger.warn(`Media is not a buffer, ${mediaFetched?.constructor.name}`)
            }

            return {
              messageUUID: message.uuid,
              byte,
              type: media.type,
              platformId: media.platformId,
              mimeType: byte ? (await fileTypeFromBuffer(byte))?.mime : undefined,
            } satisfies CoreMessageMediaFromServer
          }),
        )

        const fetchedMedia = await Promise.all(mediaPromises)

        yield {
          ...message,
          media: fetchedMedia,
        } satisfies CoreMessage
      }
    },
  }
}
