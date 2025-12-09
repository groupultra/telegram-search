// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

/**
 * Core media representation used inside the backend.
 *
 * - `byte` is optional so we can avoid shipping raw media buffers over WebSocket.
 * - `queryId` is an optional opaque identifier (typically the DB primary key)
 *   that the client can use to fetch media via HTTP endpoints.
 * - `mimeType` is optional and can be populated lazily (e.g. via file-type).
 */
export interface CoreMessageMediaBase {
  platformId: string
  messageUUID?: string

  /**
   * Raw media bytes (only used on the server / storage pipeline).
   * This should not be sent to browser clients over WebSocket.
   */
  byte?: Buffer

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
 * - May include Telegram `apiMedia` and raw `byte` buffers.
 * - Should not be exposed directly to untrusted clients.
 */
export type CoreMessageMediaFromServer = CoreMessageMedia & {
  /**
   * Raw Telegram media object.
   * Typed as unknown here to avoid pulling in Telegram types everywhere.
   */
  apiMedia?: unknown
}

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
