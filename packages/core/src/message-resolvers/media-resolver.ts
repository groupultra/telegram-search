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
import {
  getPhotoQueryIdByFileId,
  getStickerQueryIdByFileId,
  recordPhotos,
  recordStickers,
} from '../models'

export function createMediaResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:media')
  // Create concurrency limit queue
  const downloadQueue = newQueue(MEDIA_DOWNLOAD_CONCURRENCY)

  return {
    async* stream(opts: MessageResolverOpts) {
      logger.verbose('Executing media resolver')

      for (let index = 0; index < opts.messages.length; index++) {
        const message = opts.messages[index]
        const rawMessage = opts.rawMessages[index]

        // If the raw Telegram message has no media, there is nothing to resolve.
        if (!rawMessage?.media || !message.media || message.media.length === 0) {
          continue
        }

        // Use concurrency limit queue to avoid downloading too many files simultaneously.
        const mediaPromises = message.media.map(media =>
          downloadQueue.add(async () => {
            logger.withFields({ media }).debug('Media')

            const db = useDrizzle()

            // TODO: store the mime type in the DB
            // Stickers: prefer existing DB row -> queryId, otherwise download & store.
            if (media.type === 'sticker') {
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

            // Photos: prefer existing DB row -> queryId, otherwise download & store.
            if (media.type === 'photo') {
              try {
                const queryId = (await getPhotoQueryIdByFileId(db, media.platformId)).orUndefined() as string | undefined
                if (queryId) {
                  // MimeType can be determined by the API endpoint when the media is requested.
                  return {
                    messageUUID: message.uuid,
                    queryId,
                    type: media.type,
                    platformId: media.platformId,
                  } satisfies CoreMessageMediaFromServer
                }
              }
              catch (error) {
                logger.withError(error).debug('Failed to resolve photo from cache, falling back to download')
              }
            }

            // TODO: check the media size
            // Fallback: download media from Telegram using the raw Api message, then persist and return queryId.
            const apiMedia = rawMessage.media as Api.TypeMessageMedia
            const mediaFetched = await ctx.getClient().downloadMedia(apiMedia)
            const byte = mediaFetched instanceof Buffer ? mediaFetched : undefined

            if (!byte) {
              logger.warn(`Media is not a buffer, ${mediaFetched?.constructor.name}`)
            }

            // Persist media bytes when available so future fetches can use queryId/HTTP endpoint.
            try {
              if (media.type === 'photo' && byte) {
                const result = await recordPhotos([{
                  type: 'photo',
                  platformId: media.platformId,
                  messageUUID: message.uuid,
                  byte,
                }])

                const inserted = result?.unwrap()?.[0]
                if (inserted?.id) {
                  const mimeType = (await fileTypeFromBuffer(byte))?.mime

                  return {
                    messageUUID: message.uuid,
                    queryId: inserted.id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                  } satisfies CoreMessageMediaFromServer
                }
              }

              if (media.type === 'sticker' && byte) {
                const result = await recordStickers([{
                  type: 'sticker',
                  platformId: media.platformId,
                  messageUUID: message.uuid,
                  byte,
                }])

                const inserted = result?.unwrap()?.[0]
                const mimeType = (await fileTypeFromBuffer(byte))?.mime

                if (inserted?.id) {
                  return {
                    messageUUID: message.uuid,
                    queryId: inserted.id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                  } satisfies CoreMessageMediaFromServer
                }
              }
            }
            catch (error) {
              logger.withError(error).warn('Failed to persist media bytes')
            }

            // Last resort: return media without queryId, using best-effort mimeType if we have bytes.
            return {
              messageUUID: message.uuid,
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
