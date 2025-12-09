import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import pako from 'pako'

import { useLogger } from '@guiiai/logg'

/**
 * Create a browser-friendly media representation.
 *
 * Strategy:
 * - If `byte` is present, create a Blob URL (legacy / browser-only mode).
 * - If no `byte` but `queryId` exists, construct an HTTP URL that the server
 *   can serve (server mode, preferred).
 * - For TGS stickers with gzip mimeType, inflate into animation data.
 */
export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  const logger = useLogger('Blob')

  // Prefer HTTP-based media fetching when we have a queryId and no bytes.
  if (!media.byte && media.queryId && media.type === 'photo') {
    media.blobUrl = `/api/v1/photos/${media.queryId}`
    logger.debug('Using HTTP media endpoint for photo', { queryId: media.queryId, url: media.blobUrl })
    return media
  }

  // when media.type is 'webpage'
  // media.byte (preview image) might be an empty buffer
  if (media.byte) {
    let buffer
    if ((media.byte as any).data?.length) {
      buffer = new Uint8Array((media.byte as any).data)
    }
    else {
      buffer = media.byte as Uint8Array
    }

    if (media.type === 'sticker' && media.mimeType === 'application/gzip') {
      media.tgsAnimationData = pako.inflate(buffer, { to: 'string' })
    }
    else {
      const blob = new Blob([buffer], { type: media.mimeType })
      const url = URL.createObjectURL(blob)
      media.blobUrl = url

      logger.log('Blob URL created:', {
        url,
        blobSize: blob.size,
      })
    }
  }

  media.byte = undefined
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
