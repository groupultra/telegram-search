import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import pako from 'pako'

export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  // when media.type is 'webpage'
  // media.byte (preview image) might be an empty buffer
  if (media.byte && (media.byte as any).data?.length) {
    const buffer = new Uint8Array((media.byte as any).data)

    if (media.type === 'sticker' && media.mimeType === 'application/gzip') {
      media.tgsAnimationData = pako.inflate(buffer, { to: 'string' })
    }
    else {
      const blob = new Blob([buffer], { type: media.mimeType })
      const url = URL.createObjectURL(blob)
      media.blobUrl = url

      // eslint-disable-next-line no-console
      console.log('[Blob] Blob URL created:', {
        url,
        blobSize: blob.size,
      })
    }
  }

  media.byte = undefined
  return media
}

export function cleanupMediaBlob(media: CoreMessageMediaFromBlob): void {
  if (media.blobUrl) {
    URL.revokeObjectURL(media.blobUrl)

    // eslint-disable-next-line no-console
    console.log('[Blob] Blob URL revoked:', { url: media.blobUrl })

    media.blobUrl = undefined
  }
}

export function cleanupMediaBlobs(mediaArray: CoreMessageMediaFromBlob[]): void {
  mediaArray.forEach(cleanupMediaBlob)
}
