// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

export interface CoreMessageMediaBase {
  platformId: string
  messageUUID?: string
  byte: Buffer | undefined
}

export type CoreMessageMediaPhoto = CoreMessageMediaBase & {
  type: 'photo'
}

export type CoreMessageMediaSticker = CoreMessageMediaBase & {
  type: 'sticker'
  emoji?: string
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

export type CoreMessageMedia = CoreMessageMediaPhoto | CoreMessageMediaSticker | CoreMessageMediaDocument | CoreMessageMediaWebPage | CoreMessageMediaUnknown

export type CoreMessageMediaFromServer = CoreMessageMedia & {
  apiMedia?: unknown // Api.TypeMessageMedia
  mimeType?: string
}

export type CoreMessageMediaFromCache = CoreMessageMedia & {
  mimeType?: string
}

export type CoreMessageMediaFromBlob = CoreMessageMedia & {
  blobUrl?: string
  mimeType?: string
  tgsAnimationData?: string
}
