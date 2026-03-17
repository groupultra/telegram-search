import type { Logger } from '@guiiai/logg'
import type { TelegramClient } from 'telegram'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { PhotoModels } from '../models/photos'
import type { StickerModels } from '../models/stickers'
import type { CoreMessageMedia, CoreMessageMediaDocument, CoreMessageMediaPhoto, CoreMessageMediaSticker, CoreMessageMediaWebPage } from '../types/media'
import type { CoreMessage } from '../types/message'
import type { MediaBinaryProvider } from '../types/storage'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { newQueue } from '@henrygd/queue'
import { fileTypeFromBuffer } from 'file-type'
import { Api } from 'telegram'
import { v4 as uuidv4 } from 'uuid'

import { MEDIA_DOWNLOAD_CONCURRENCY } from '../constants'
import { must0 } from '../models/utils/must'

/**
 * Pick the largest photo size type from a photo's sizes array.
 * Telegram stores photos in multiple resolutions; the last PhotoSize or
 * PhotoSizeProgressive entry is typically the largest.
 * Reference: tdl's GetPhotoSize logic.
 */
function getLastPhotoSizeType(sizes: Api.TypePhotoSize[]): string | undefined {
  for (let i = sizes.length - 1; i >= 0; i--) {
    const s = sizes[i]
    if (s instanceof Api.PhotoSize || s instanceof Api.PhotoSizeProgressive) {
      return s.type
    }
  }
  return undefined
}

function getLargestPhotoDimensions(sizes: Api.TypePhotoSize[]): { width?: number, height?: number } {
  for (let i = sizes.length - 1; i >= 0; i--) {
    const size = sizes[i]
    if (size instanceof Api.PhotoSize || size instanceof Api.PhotoCachedSize || size instanceof Api.PhotoSizeProgressive) {
      return {
        width: size.w || undefined,
        height: size.h || undefined,
      }
    }
  }

  return {}
}

function getDocumentDimensions(document: Api.Document): { width?: number, height?: number } {
  for (const attribute of document.attributes) {
    if (attribute instanceof Api.DocumentAttributeImageSize || attribute instanceof Api.DocumentAttributeVideo) {
      return {
        width: attribute.w || undefined,
        height: attribute.h || undefined,
      }
    }
  }

  return {}
}

/**
 * Download media directly by constructing InputFileLocation and calling
 * client.downloadFile, bypassing the high-level downloadMedia wrapper.
 *
 * This works for channels with noForwards because Telegram's forwarding
 * restriction only applies to forward/send APIs, not to upload.getFile
 * which downloadFile uses under the hood.
 *
 * Reference: tdl's GetDocumentInfo / GetPhotoInfo.
 */
async function downloadMediaDirect(
  client: TelegramClient,
  rawMedia: Api.TypeMessageMedia,
  logger: Logger,
): Promise<Buffer | undefined> {
  // Document (sticker, GIF, video, file, etc.)
  if (rawMedia instanceof Api.MessageMediaDocument
    && rawMedia.document instanceof Api.Document) {
    const doc = rawMedia.document
    const location = new Api.InputDocumentFileLocation({
      id: doc.id,
      accessHash: doc.accessHash,
      fileReference: doc.fileReference,
      thumbSize: '', // empty string = full file, not a thumbnail
    })
    logger.debug('Attempting direct download for Document via InputDocumentFileLocation')
    const result = await client.downloadFile(location, { dcId: doc.dcId })
    return result instanceof Buffer ? result : undefined
  }

  // Photo
  if (rawMedia instanceof Api.MessageMediaPhoto
    && rawMedia.photo instanceof Api.Photo) {
    const photo = rawMedia.photo
    const thumbSize = getLastPhotoSizeType(photo.sizes)
    if (!thumbSize)
      return undefined

    const location = new Api.InputPhotoFileLocation({
      id: photo.id,
      accessHash: photo.accessHash,
      fileReference: photo.fileReference,
      thumbSize,
    })
    logger.debug('Attempting direct download for Photo via InputPhotoFileLocation')
    const result = await client.downloadFile(location, { dcId: photo.dcId })
    return result instanceof Buffer ? result : undefined
  }

  return undefined
}

export function createMediaResolver(
  ctx: CoreContext,
  logger: Logger,
  photoModels: PhotoModels,
  stickerModels: StickerModels,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
): MessageResolver {
  logger = logger.withContext('core:resolver:media')

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
                  ctx.metrics?.mediaDownload.inc({ outcome: 'cache_hit' })
                  return {
                    messageUUID: message.uuid,
                    queryId: sticker.id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType: sticker.mimeType,
                    width: sticker.width || undefined,
                    height: sticker.height || undefined,
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
                  // Update message_id to ensure photo-embedding-resolver can find it
                  await photoModels.updatePhotoMessageId(db, photo.id, message.uuid)

                  logger.withFields({
                    photoId: photo.id,
                    messageUUID: message.uuid,
                    platformId: media.platformId,
                  }).log('Photo found in cache, updated message_id')

                  ctx.metrics?.mediaDownload.inc({ outcome: 'cache_hit' })
                  return {
                    messageUUID: message.uuid,
                    queryId: photo.id,
                    mimeType: photo.mimeType,
                    type: media.type,
                    platformId: media.platformId,
                    width: photo.width || undefined,
                    height: photo.height || undefined,
                  } satisfies CoreMessageMedia
                }
              }
              catch (error) {
                logger.withError(error).debug('Failed to resolve photo from cache, falling back to download')
              }
            }

            // Check media size if limit is set
            if (opts.syncOptions?.maxMediaSize && opts.syncOptions.maxMediaSize > 0) {
              let size: number | undefined
              if (rawMessage.media instanceof Api.MessageMediaPhoto && rawMessage.media.photo instanceof Api.Photo) {
                // Get the largest size
                size = Math.max(...rawMessage.media.photo.sizes.map((s) => {
                  if (s instanceof Api.PhotoSize || s instanceof Api.PhotoCachedSize || s instanceof Api.PhotoStrippedSize) {
                    return 'size' in s ? (s.size as number) : 0
                  }
                  return 0
                }))
              }
              else if (rawMessage.media instanceof Api.MessageMediaDocument && rawMessage.media.document instanceof Api.Document) {
                size = Number(rawMessage.media.document.size)
              }

              if (size && size > opts.syncOptions.maxMediaSize * 1024 * 1024) {
                logger.withFields({ size, limit: opts.syncOptions.maxMediaSize }).debug('Skipping media due to size limit')
                return {
                  messageUUID: message.uuid,
                  type: 'unknown',
                  platformId: media.platformId,
                } satisfies CoreMessageMedia
              }
            }

            // Download media from Telegram using the raw Api message, then persist and return queryId.
            const apiMedia = rawMessage.media as Api.TypeMessageMedia
            const client = ctx.getClient()
            let byte: Buffer | undefined
            let downloadOutcome: 'downloaded' | 'fallback' | 'error' = 'error'

            try {
              const mediaFetched = await client.downloadMedia(apiMedia)
              byte = mediaFetched instanceof Buffer ? mediaFetched : undefined
              if (byte)
                downloadOutcome = 'downloaded'
            }
            catch (err) {
              logger.withError(err as Error).debug('downloadMedia failed, trying direct download via InputFileLocation')
            }

            // NOTICE: Some channels block high-level downloadMedia paths (e.g. noForwards).
            // Build InputFileLocation manually and fallback to downloadFile/upload.getFile.
            if (!byte) {
              try {
                byte = await downloadMediaDirect(client, apiMedia, logger)
                if (byte)
                  downloadOutcome = 'fallback'
              }
              catch (err) {
                logger.withError(err as Error).debug('Direct download fallback also failed')
              }
            }

            ctx.metrics?.mediaDownload.inc({ outcome: downloadOutcome })

            let mimeType: string | undefined
            if (!byte || !(byte instanceof Buffer)) {
              logger.warn('Media download returned no buffer')
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

                  const photoDimensions = rawMessage.media instanceof Api.MessageMediaPhoto && rawMessage.media.photo instanceof Api.Photo
                    ? getLargestPhotoDimensions(rawMessage.media.photo.sizes)
                    : {}

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
                    width: photoDimensions.width,
                    height: photoDimensions.height,
                  }])

                  logger.withFields({
                    photoId: uuid,
                    messageUUID: message.uuid,
                    platformId: media.platformId,
                  }).log('Photo saved to database')

                  return {
                    messageUUID: message.uuid,
                    queryId: must0(result).id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                    width: photoDimensions.width,
                    height: photoDimensions.height,
                  } satisfies CoreMessageMediaPhoto
                }

                case 'sticker': {
                  if (!byte)
                    break

                  const stickerDimensions = rawMessage.media instanceof Api.MessageMediaDocument && rawMessage.media.document instanceof Api.Document
                    ? getDocumentDimensions(rawMessage.media.document)
                    : {}

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
                    width: stickerDimensions.width,
                    height: stickerDimensions.height,
                  }])

                  return {
                    messageUUID: message.uuid,
                    queryId: must0(result).id,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                    width: stickerDimensions.width,
                    height: stickerDimensions.height,
                  } satisfies CoreMessageMediaSticker
                }

                case 'document': {
                  return {
                    messageUUID: message.uuid,
                    type: media.type,
                    platformId: media.platformId,
                    mimeType,
                  } satisfies CoreMessageMediaDocument
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
