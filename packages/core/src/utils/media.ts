// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import { Api } from 'telegram'

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

type CoreMessageMedia = CoreMessageMediaPhoto | CoreMessageMediaSticker | CoreMessageMediaDocument | CoreMessageMediaWebPage | CoreMessageMediaUnknown

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
}

export function parseMediaType(apiMedia: Api.TypeMessageMedia): CoreMessageMedia['type'] {
  switch (true) {
    case apiMedia instanceof Api.MessageMediaPhoto:
      return 'photo'
    case apiMedia instanceof Api.MessageMediaDocument:
      // TODO: Better way to check if it's a sticker
      if (apiMedia.document && apiMedia.document.className === 'Document') {
        const isSticker = apiMedia.document.attributes.find((attr: any) => attr.className === 'DocumentAttributeSticker')
        if (isSticker) {
          return 'sticker'
        }
      }
      return 'document'
    case apiMedia instanceof Api.MessageMediaWebPage:
      return 'webpage'
    default:
      return 'unknown'
  }
}

export function parseMediaId(apiMedia: Api.TypeMessageMedia): string {
  switch (true) {
    case apiMedia instanceof Api.MessageMediaPhoto:
      return apiMedia.photo?.id.toString() ?? ''
    case apiMedia instanceof Api.MessageMediaDocument:
      return apiMedia.document?.id.toString() ?? ''
    default:
      return ''
  }
}
