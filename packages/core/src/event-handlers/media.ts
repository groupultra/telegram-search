import type { CoreContext } from '../context'
import type { MediaService } from '../services/media'

import { useLogger } from '@tg-search/common'

export function registerMediaEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:media:event')

  return (mediaService: MediaService) => {
    emitter.on('media:fetch', async ({ messages }) => {
      logger.withFields({ messages }).log('Media fetch')
      await mediaService.fetchMedia(messages)
    })

    // emitter.on('media:data', async ({ path, message, media }) => {
    //   logger.withFields({ path }).log('Media data received')

    //   emitter.emit('message:process', { messages: [
    //     {
    //       ...message,
    //       media: [{ apiMedia: message.media!, media }],
    //     },
    //   ] })
    // })
  }
}
