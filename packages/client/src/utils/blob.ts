import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'

/**
 * Create a browser-friendly media representation.
 *
 * Strategy:
 * - If `queryId` exists, construct an HTTP URL that the server can serve.
 * - No Blob / byte handling here; media bytes are always fetched via HTTP.
 */
export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  const logger = useLogger('Blob')

  if (media.queryId && media.type === 'photo') {
    media.blobUrl = `/api/v1/photos/${media.queryId}`
    logger.debug('Using HTTP media endpoint for photo', { queryId: media.queryId, url: media.blobUrl })
  }

  return media
}

export function cleanupMediaBlob(media: CoreMessageMediaFromBlob): void {
  if (media.blobUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(media.blobUrl)

    useLogger('Blob').log('Blob URL revoked:', { url: media.blobUrl })
  }

  media.blobUrl = undefined
}

export function cleanupMediaBlobs(mediaArray: CoreMessageMediaFromBlob[]): void {
  mediaArray.forEach(cleanupMediaBlob)
}
