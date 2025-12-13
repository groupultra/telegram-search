import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { PhotoModels } from '../models/photos'
import type { StickerModels } from '../models/stickers'
import type { CoreMessageMedia, CoreMessageMediaPhoto, CoreMessageMediaSticker, CoreMessageMediaWebPage } from '../types/media'
import type { CoreMessage } from '../types/message'
import type { MediaBinaryProvider } from '../types/storage'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { useLogger } from '@guiiai/logg'
import { newQueue } from '@henrygd/queue'
import { fileTypeFromBuffer } from 'file-type'
import { Api } from 'telegram'
import { v4 as uuidv4 } from 'uuid'

import { MEDIA_DOWNLOAD_CONCURRENCY } from '../constants'
import { must0 } from '../models/utils/must'

export function createMediaResolver(
  ctx: CoreContext,
  photoModels: PhotoModels,
  stickerModels: StickerModels,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
): MessageResolver {
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

            const db = ctx.getDB()

            // Stickers: prefer existing DB row -> queryId, otherwise download & store.
            // Skip cache lookup if forceRefetch is enabled (e.g., for reprocessing after 404 errors).
            if (media.type === 'sticker' && !opts.forceRefetch) {
              try {
                const sticker = (await stickerModels.getStickerQueryIdByFileIdWithMimeType(db, media.platformId)).orUndefined()

                if (sticker) {
                  return {
                    messageUUID: message.uuid,
                    queryId: sticker.id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType: sticker.mimeType,
                  } satisfies CoreMessageMedia
                }
              }
              catch (error) {
                logger.withError(error).debug('Failed to resolve sticker from cache, falling back to download')
              }
            }

            // Photos: prefer existing DB row -> queryId, otherwise download & store.
            // Skip cache lookup if forceRefetch is enabled (e.g., for reprocessing after 404 errors).
            if (media.type === 'photo' && !opts.forceRefetch) {
              try {
                const photo = (await photoModels.findPhotoByFileIdWithMimeType(db, media.platformId)).orUndefined()
                if (photo) {
                  return {
                    messageUUID: message.uuid,
                    queryId: photo.id,
                    mimeType: photo.mimeType,
                    type: media.type,
                    platformId: media.platformId,
                  } satisfies CoreMessageMedia
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

            // TODO: download video by _downloadDocument

            let mimeType: string | undefined
            if (!byte || !(byte instanceof Buffer)) {
              logger.warn(`Media is not a buffer, ${mediaFetched?.constructor.name}`)
            }
            else {
              mimeType = (await fileTypeFromBuffer(byte))?.mime
            }

            // Persist media bytes when available so future fetches can use queryId/HTTP endpoint.
            try {
              const uuid = uuidv4()

              switch (media.type) {
                case 'photo': {
                  if (!byte)
                    break

                  let storagePath: string | undefined

                  if (mediaBinaryProvider) {
                    const location = await mediaBinaryProvider.save(
                      { uuid, kind: 'photo' },
                      new Uint8Array(byte),
                      mimeType,
                    )
                    storagePath = location.path
                  }

                  const result = await photoModels.recordPhotos(db, [{
                    uuid,
                    type: 'photo',
                    platformId: media.platformId,
                    messageUUID: message.uuid,
                    byte,
                    mimeType,
                    storagePath,
                  }])

                  return {
                    messageUUID: message.uuid,
                    queryId: must0(result).id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                  } satisfies CoreMessageMediaPhoto
                }

                case 'sticker': {
                  if (!byte)
                    break

                  let storagePath: string | undefined

                  if (mediaBinaryProvider) {
                    const location = await mediaBinaryProvider.save(
                      { uuid, kind: 'sticker' },
                      new Uint8Array(byte),
                      mimeType,
                    )
                    storagePath = location.path
                  }

                  const result = await stickerModels.recordStickers(db, [{
                    uuid,
                    type: 'sticker',
                    platformId: media.platformId,
                    messageUUID: message.uuid,
                    byte,
                    mimeType,
                    storagePath,
                  }])

                  return {
                    messageUUID: message.uuid,
                    queryId: must0(result).id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                  } satisfies CoreMessageMediaSticker
                }

                case 'webpage': {
                  if (!(rawMessage.media instanceof Api.MessageMediaWebPage))
                    break

                  const webpage = rawMessage.media.webpage as Api.WebPage
                  if (!rawMessage.media.webpage || rawMessage.media.webpage instanceof Api.WebPageEmpty)
                    break

                  return {
                    messageUUID: message.uuid,
                    type: media.type,
                    platformId: media.platformId,
                    title: webpage.title ?? 'Unknown',
                    description: webpage.description,
                    siteName: webpage.siteName,
                    url: webpage.url,
                    displayUrl: webpage.displayUrl,
                  } satisfies CoreMessageMediaWebPage
                }
              }
            }
            catch (error) {
              logger.withError(error).warn('Failed to persist media bytes')
            }

            // Last resort: return media without queryId, using best-effort mimeType if we have bytes.
            return {
              messageUUID: message.uuid,
              type: 'unknown',
              platformId: media.platformId,
              mimeType: mimeType ?? (byte ? (await fileTypeFromBuffer(byte))?.mime : undefined),
            } satisfies CoreMessageMedia
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
