import type { Api } from 'telegram'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { CoreMessage, CoreMessageMedia } from '../utils/message'

import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { useLogger } from '@tg-search/common'
import { getMediaPath, useConfig } from '@tg-search/common/node'

export function createMediaResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:media')
  const { getClient } = ctx

  const mediaPath = getMediaPath(useConfig().path.storage)

  async function useUserMediaPath() {
    const userId = (await getClient().getMe()).id.toString()
    const userMediaPath = join(mediaPath, userId)
    if (!existsSync(userMediaPath)) {
      mkdirSync(userMediaPath, { recursive: true })
    }

    return userMediaPath
  }

  return {
    async* stream(opts: MessageResolverOpts) {
      logger.verbose('Executing media resolver')

      for (const message of opts.messages) {
        if (!message.media || message.media.length === 0) {
          yield message
          continue
        }

        const fetchedMedia = await Promise.all(
          message.media.map(async (media) => {
            logger.withFields({ media }).debug('Media')

            const userMediaPath = join(await useUserMediaPath(), message.chatId.toString())
            if (!existsSync(userMediaPath)) {
              mkdirSync(userMediaPath, { recursive: true })
            }

            const mediaFetched = await ctx.getClient().downloadMedia(media.apiMedia as Api.TypeMessageMedia)

            const mediaPath = join(userMediaPath, message.platformMessageId)
            logger.withFields({ mediaPath }).verbose('Media path')
            if (mediaFetched instanceof Buffer) {
            // write file to disk async
              void writeFile(mediaPath, mediaFetched)
            }

            const byte = mediaFetched instanceof Buffer ? mediaFetched : undefined

            return {
              apiMedia: media.apiMedia,
              byte,
              type: media.type,
              messageUUID: media.messageUUID,
              path: mediaPath,
            } satisfies CoreMessageMedia
          }),
        )

        yield {
          ...message,
          media: fetchedMedia,
        } satisfies CoreMessage
      }
    },
  }
}
