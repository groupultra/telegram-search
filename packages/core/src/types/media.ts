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

  /**
   * TGS animation data (uncompressed JSON string).
   * Kept for backward compatibility; new flows should prefer queryId.
   */
  tgsAnimationData?: string
}

export type CoreMessageMediaDocument = CoreMessageMediaBase & {
  type: 'document'
}

export type CoreMessageMediaWebPage = CoreMessageMediaBase & {
  type: 'webpage'
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

/**
 * Media representation used in the core pipeline (server-side).
 *
 * Kept as a distinct alias for clarity, but intentionally identical to
 * `CoreMessageMedia` so that core messages never carry raw Telegram types.
 */
export type CoreMessageMediaFromServer = CoreMessageMedia

/**
 * Media representation that has been hydrated from cache / database.
 *
 * - Typically has `queryId` populated.
 * - May also have `mimeType` populated.
 */
export type CoreMessageMediaFromCache = CoreMessageMedia & {
}

/**
 * Media representation used by the browser.
 *
 * - `blobUrl` is a local object URL created from a Blob, OR
 * - the client can use `queryId` to construct an HTTP URL instead.
 */
export type CoreMessageMediaFromBlob = CoreMessageMedia & {
  blobUrl?: string
}
