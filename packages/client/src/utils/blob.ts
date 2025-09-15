import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import pako from 'pako'

export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  if (media.byte) {
    if (media.type === 'sticker' && media.mimeType === 'application/gzip') {
      try {
        media.tgsAnimationData = pako.inflate(media.byte, { to: 'string' })
      }
      catch {
        console.error('Failed to inflate TGS data')
      }
    }
    else {
      try {
        const blob = new Blob([media.byte as ArrayBufferView<ArrayBuffer>], { type: media.mimeType })
        media.blobUrl = URL.createObjectURL(blob)

        // eslint-disable-next-line no-console
        console.log('[Blob] Blob URL created:', {
          url: media.blobUrl,
          blobSize: blob.size,
        })
      }
      catch {
        console.error('Failed to create blob URL')
      }
    }

    // Since we don't need the byte anymore, we can free up the memory
    media.byte = undefined
  }

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
