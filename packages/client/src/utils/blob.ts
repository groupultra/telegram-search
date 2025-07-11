import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import { getMediaMimeType } from './mime'

export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  if (media.byte) {
    const buffer = new Uint8Array((media.byte as any).data)

    const mimeType = getMediaMimeType(media.type)
    const blob = new Blob([buffer], { type: mimeType })
    const url = URL.createObjectURL(blob)
    // FIXME: URL.revokeObjectURL()
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
