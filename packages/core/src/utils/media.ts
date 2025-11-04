import type { CoreMessageMedia } from '../types/media'

import { Api } from 'telegram'

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
