import type { Api } from 'telegram'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { CoreMessageMediaFromCache, CoreMessageMediaFromServer } from '../utils/media'
import type { CoreMessage } from '../utils/message'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { useLogger } from '@unbird/logg'
import { fileTypeFromBuffer } from 'file-type'

import { findPhotoByFileId, findStickerByFileId } from '../models'

export function createMediaResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:media')

  return {
    async* stream(opts: MessageResolverOpts) {
      logger.verbose('Executing media resolver')

      for (const message of opts.messages) {
        if (!message.media || message.media.length === 0) {
          continue
        }

        const fetchedMedia = await Promise.all(
          message.media.map(async (media) => {
            logger.withFields({ media }).debug('Media')

            // FIXME: move it to storage
            if (media.type === 'sticker') {
              const sticker = (await findStickerByFileId(media.platformId)).unwrap()

              // 只有当数据库中有 sticker_bytes 时才直接返回
              if (sticker && sticker.sticker_bytes) {
                return {
                  messageUUID: message.uuid,
                  byte: sticker.sticker_bytes,
                  type: media.type,
                  platformId: media.platformId,
                  mimeType: (await fileTypeFromBuffer(sticker.sticker_bytes))?.mime,
                } satisfies CoreMessageMediaFromCache
              }
            }

            // FIXME: move it to storage
            if (media.type === 'photo') {
              const photo = (await findPhotoByFileId(media.platformId)).unwrap()

              if (photo && photo.image_bytes) {
                return {
                  messageUUID: message.uuid,
                  byte: photo.image_bytes,
                  type: media.type,
                  platformId: media.platformId,
                  mimeType: (await fileTypeFromBuffer(photo.image_bytes))?.mime,
                } satisfies CoreMessageMediaFromServer
              }
            }

            const mediaFetched = await ctx.getClient().downloadMedia(media.apiMedia as Api.TypeMessageMedia)
            const byte = mediaFetched instanceof Buffer ? mediaFetched : undefined
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

        yield {
          ...message,
          media: fetchedMedia,
        } satisfies CoreMessage
      }
    },
  }
}
