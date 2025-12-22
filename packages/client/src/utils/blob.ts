import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'

import { API_BASE, IS_CORE_MODE } from '../../constants'

/**
 * Create a browser-friendly media representation.
 *
 * Strategy:
 * - In server (WebSocket) mode, if `queryId` exists, construct an HTTP URL that the server can serve.
 * - In With Core (browser-only) mode, hydration is handled lazily by the UI layer when media is rendered.
 */
export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  const logger = useLogger('Blob')

  // In With Core mode (browser-embedded core), there is no HTTP API backend.
  // The UI is responsible for hydrating media from the embedded database when
  // it actually needs to render the image/video.
  if (IS_CORE_MODE) {
    logger.debug('With Core mode detected; skipping HTTP media endpoint in createMediaBlob', {
      type: media.type,
      queryId: media.queryId,
    })

    return media
  }

  if (media.queryId && media.type === 'photo') {
    media.blobUrl = `${API_BASE}/v1/photos/${media.queryId}`
    logger.debug('Using HTTP media endpoint for photo', { queryId: media.queryId, url: media.blobUrl })
  }

  if (media.queryId && media.type === 'sticker') {
    media.blobUrl = `${API_BASE}/v1/stickers/${media.queryId}`
    logger.debug('Using HTTP media endpoint for sticker', { queryId: media.queryId, url: media.blobUrl })
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
