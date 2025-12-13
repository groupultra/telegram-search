import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { findPhotoByQueryId, findStickerByQueryId } from '@tg-search/core'

import { getDB } from './core-db'

export async function hydrateMediaBlobWithCore(media: CoreMessageMediaFromBlob): Promise<void> {
  const logger = useLogger('MediaWithCore')

  if (!media.queryId) {
    return
  }

  const db = getDB()

  try {
    if (media.type === 'photo') {
      const photo = (await findPhotoByQueryId(db, media.queryId)).orUndefined()
      const bytes = photo?.image_bytes

      if (!bytes) {
        return
      }

      // Normalize to Uint8Array to satisfy BlobPart typing across environments.
      const uint8 = new Uint8Array(bytes as unknown as ArrayBufferLike)
      const blob = new Blob([uint8 as unknown as BlobPart], { type: media.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)

      media.blobUrl = url

      logger.debug('Hydrated photo blob in With Core mode', { queryId: media.queryId })
      return
    }

    if (media.type === 'sticker') {
      const sticker = (await findStickerByQueryId(db, media.queryId)).orUndefined()
      const bytes = sticker?.sticker_bytes

      if (!bytes) {
        return
      }

      // Normalize to Uint8Array to satisfy BlobPart typing across environments.
      const uint8 = new Uint8Array(bytes as unknown as ArrayBufferLike)
      const blob = new Blob([uint8 as unknown as BlobPart], { type: media.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)

      media.blobUrl = url

      logger.debug('Hydrated sticker blob in With Core mode', { queryId: media.queryId })
    }
  }
  catch (error) {
    logger.withError(error).warn('Failed to hydrate media blob in With Core mode')
  }
}
