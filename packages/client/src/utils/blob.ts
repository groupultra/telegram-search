import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import pako from 'pako'

export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  if (media.byte !== undefined) {
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
      }
      catch {
        console.error('Failed to create blob URL')
      }
    }
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
