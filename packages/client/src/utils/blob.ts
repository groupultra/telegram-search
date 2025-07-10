import type { CoreMessageMedia } from '@tg-search/core'

import { getMediaMimeType } from './mime'

export function createMediaBlob(media: CoreMessageMedia) {
  if (media.byte) {
    const buffer = new Uint8Array((media.byte as any).data)

    const mimeType = getMediaMimeType(media.type)
    const blob = new Blob([buffer], { type: mimeType })
    const url = URL.createObjectURL(blob)
    media.blobUrl = url

    // eslint-disable-next-line no-console
    console.log('[Blob] Blob URL created:', {
      url,
      mimeType,
      blobSize: blob.size,
    })

    media.byte = undefined
  }

  return media
}

export function cleanupMediaBlob(media: CoreMessageMedia): void {
  if (media.blobUrl) {
    URL.revokeObjectURL(media.blobUrl)

    // eslint-disable-next-line no-console
    console.log('[Blob] Blob URL revoked:', { url: media.blobUrl })

    media.blobUrl = undefined
  }
}

export function cleanupMediaBlobs(mediaArray: CoreMessageMedia[]): void {
  mediaArray.forEach(cleanupMediaBlob)
}
