import type { Api } from 'telegram'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { CoreMessageMediaFromCache, CoreMessageMediaFromServer } from '../types/media'
import type { CoreMessage } from '../types/message'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { useLogger } from '@guiiai/logg'
import { newQueue } from '@henrygd/queue'
import { fileTypeFromBuffer } from 'file-type'

import { MEDIA_DOWNLOAD_CONCURRENCY } from '../constants'
import { findPhotoByFileId, findStickerByFileId } from '../models'

export function createMediaResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:media')
  // Create concurrency limit queue
  const downloadQueue = newQueue(MEDIA_DOWNLOAD_CONCURRENCY)

  return {
    async* stream(opts: MessageResolverOpts) {
      logger.verbose('Executing media resolver')

      // Get media size limit from sync options (in MB, 0 = unlimited)
      const maxMediaSizeMB = opts.syncOptions?.maxMediaSize ?? 0
      const maxMediaSizeBytes = maxMediaSizeMB > 0 ? maxMediaSizeMB * 1024 * 1024 : Number.POSITIVE_INFINITY

      for (const message of opts.messages) {
        if (!message.media || message.media.length === 0) {
          continue
        }

        // Use concurrency limit queue to avoid downloading too many files simultaneously
        const mediaPromises = message.media.map(media =>
          downloadQueue.add(async () => {
            logger.withFields({ media }).debug('Media')

            // TODO: move it to storage
            if (media.type === 'sticker') {
              const sticker = (await findStickerByFileId(media.platformId)).unwrap()

              // Only return directly when sticker_bytes exists in the database
              if (sticker && sticker.sticker_bytes) {
                const stickerBytes = sticker.sticker_bytes
                return {
                  messageUUID: message.uuid,
                  byte: stickerBytes,
                  type: media.type,
                  platformId: media.platformId,
                  mimeType: (await fileTypeFromBuffer(stickerBytes))?.mime,
                } satisfies CoreMessageMediaFromCache
              }
            }

            // TODO: move it to storage
            if (media.type === 'photo') {
              const photo = (await findPhotoByFileId(media.platformId)).unwrap()
              if (photo && photo.image_bytes) {
                const imageBytes = photo.image_bytes
                return {
                  messageUUID: message.uuid,
                  byte: imageBytes,
                  type: media.type,
                  platformId: media.platformId,
                  mimeType: (await fileTypeFromBuffer(imageBytes))?.mime,
                } satisfies CoreMessageMediaFromServer
              }
            }

            const mediaFetched = await ctx.getClient().downloadMedia(media.apiMedia as Api.TypeMessageMedia)
            const byte = mediaFetched instanceof Buffer ? mediaFetched : undefined

            if (!byte) {
              logger.warn(`Media is not a buffer, ${mediaFetched?.constructor.name}`)
            }

            // Check media size against limit
            if (byte && byte.length > maxMediaSizeBytes) {
              logger.withFields({
                size: byte.length,
                maxSize: maxMediaSizeBytes,
                platformId: media.platformId,
              }).verbose('Media exceeds size limit, skipping')
              return {
                messageUUID: message.uuid,
                byte: undefined, // Skip media that exceeds size limit
                type: media.type,
                platformId: media.platformId,
                mimeType: undefined,
              } satisfies CoreMessageMediaFromServer
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
