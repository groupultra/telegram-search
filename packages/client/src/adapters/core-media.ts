import type {
  CoreMessageMediaFromBlob,
  MediaBinaryLocation,
  MediaBinaryProvider,
  PhotoModels,
  StickerModels,
} from '@tg-search/core'

import { useLogger } from '@guiiai/logg'

import { getDB } from './core-db'

export async function hydrateMediaBlobWithCore(
  media: CoreMessageMediaFromBlob,
  photoModels: PhotoModels,
  stickerModels: StickerModels,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
): Promise<void> {
  const logger = useLogger('MediaWithCore')

  if (!media.queryId) {
    return
  }

  const db = getDB()

  try {
    if (media.type === 'photo') {
      const photo = (await photoModels.findPhotoByQueryId(db, media.queryId)).orUndefined()

      let bytes: Uint8Array | undefined

      if (mediaBinaryProvider && photo?.image_path) {
        const location: MediaBinaryLocation = {
          kind: 'photo',
          path: photo.image_path,
        }
        bytes = await mediaBinaryProvider.load(location) ?? undefined
      }
      else if (photo?.image_bytes) {
        bytes = new Uint8Array(photo.image_bytes as unknown as ArrayBufferLike)
      }

      if (!bytes) {
        return
      }

      // Normalize to Uint8Array to satisfy BlobPart typing across environments.
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: photo?.image_mime_type || media.mimeType || 'application/octet-stream',
      })
      const url = URL.createObjectURL(blob)

      media.blobUrl = url

      logger.debug('Hydrated photo blob in With Core mode', { queryId: media.queryId })
      return
    }

    if (media.type === 'sticker') {
      const sticker = (await stickerModels.findStickerByQueryId(db, media.queryId)).orUndefined()

      let bytes: Uint8Array | undefined

      if (mediaBinaryProvider && sticker?.sticker_path) {
        const location: MediaBinaryLocation = {
          kind: 'sticker',
          path: sticker.sticker_path,
        }
        bytes = await mediaBinaryProvider.load(location) ?? undefined
      }
      else if (sticker?.sticker_bytes) {
        bytes = new Uint8Array(sticker.sticker_bytes as unknown as ArrayBufferLike)
      }

      if (!bytes) {
        return
      }

      // Normalize to Uint8Array to satisfy BlobPart typing across environments.
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: sticker?.sticker_mime_type || media.mimeType || 'application/octet-stream',
      })
      const url = URL.createObjectURL(blob)

      media.blobUrl = url

      logger.debug('Hydrated sticker blob in With Core mode', { queryId: media.queryId })
    }
  }
  catch (error) {
    logger.withError(error).warn('Failed to hydrate media blob in With Core mode')
  }
}
