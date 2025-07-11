import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import pako from 'pako'

export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  if (media.byte) {
    const buffer = new Uint8Array((media.byte as any).data)

    if (media.type === 'sticker' && media.mimeType === 'application/gzip') {
      media.tgsAnimationData = pako.inflate(buffer, { to: 'string' })
    }
    else {
      const blob = new Blob([buffer], { type: media.mimeType })
      const url = URL.createObjectURL(blob)
      // FIXME: URL.revokeObjectURL()
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
