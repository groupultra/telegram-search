/**
 * Core media representation used inside the backend.
 *
 * - `queryId` is an optional opaque identifier (typically the DB primary key)
 *   that the client can use to fetch media via HTTP endpoints.
 * - `mimeType` is optional and can be populated lazily (e.g. via file-type).
 */
export interface CoreMessageMediaBase {
  platformId: string
  messageUUID?: string

  /**
   * Opaque identifier that can be used by clients to query media
   * via dedicated HTTP endpoints (e.g. /v1/photos/:queryId).
   */
  queryId?: string

  /**
   * Best-effort MIME type for the media.
   */
  mimeType?: string
}

export type CoreMessageMediaPhoto = CoreMessageMediaBase & {
  type: 'photo'
}

export type CoreMessageMediaSticker = CoreMessageMediaBase & {
  type: 'sticker'

  /**
   * Emoji associated with the sticker (if available).
   */
  emoji?: string
}

export type CoreMessageMediaDocument = CoreMessageMediaBase & {
  type: 'document'
}

export type CoreMessageMediaWebPage = CoreMessageMediaBase & {
  type: 'webpage'
  title: string
  description?: string
  siteName?: string
  url?: string
  displayUrl?: string
  previewImage?: string
}

export type CoreMessageMediaUnknown = CoreMessageMediaBase & {
  type: 'unknown'
}

export type CoreMessageMedia
  = | CoreMessageMediaPhoto
    | CoreMessageMediaSticker
    | CoreMessageMediaDocument
    | CoreMessageMediaWebPage
    | CoreMessageMediaUnknown

export type CoreMessageMediaType = CoreMessageMedia['type']

/**
 * Media representation used by the browser.
 *
 * - `blobUrl` is a local object URL created from a Blob, OR
 * - the client can use `queryId` to construct an HTTP URL instead.
 */
export type CoreMessageMediaFromBlob = CoreMessageMedia & {
  blobUrl?: string
}
