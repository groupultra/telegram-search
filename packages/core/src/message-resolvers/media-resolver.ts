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
  // 创建并发限制队列
  const downloadQueue = newQueue(MEDIA_DOWNLOAD_CONCURRENCY)

  return {
    async* stream(opts: MessageResolverOpts) {
      logger.verbose('Executing media resolver')

      for (const message of opts.messages) {
        if (!message.media || message.media.length === 0) {
          continue
        }

        // 使用并发限制队列，避免同时下载过多文件
        const mediaPromises = message.media.map(media =>
          downloadQueue.add(async () => {
            logger.withFields({ media }).debug('Media')

            // FIXME: move it to storage
            if (media.type === 'sticker') {
              const sticker = (await findStickerByFileId(media.platformId)).unwrap()

              // 只有当数据库中有 sticker_bytes 时才直接返回
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

            // FIXME: move it to storage
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

            return {
              messageUUID: message.uuid,
              apiMedia: media.apiMedia,
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
