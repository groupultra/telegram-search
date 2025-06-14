import type { Api } from 'telegram'
import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { CoreMessage } from '../utils/message'

import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { useLogger } from '@tg-search/common'
import { getMediaPath, useConfig } from '@tg-search/common/composable'

import { Ok } from '../utils/monad'

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
    run: async (opts: MessageResolverOpts) => {
      logger.verbose('Executing media resolver')

      const resolvedMessages = await Promise.all(
        opts.messages.map(async (message) => {
          if (!message.media)
            return message

          const fetchedMedias = await Promise.all(
            message.media.map(async (media) => {
              logger.withFields({ media }).debug('Media')

              const userMediaPath = join(await useUserMediaPath(), message.chatId.toString())
              if (!existsSync(userMediaPath)) {
                mkdirSync(userMediaPath, { recursive: true })
              }

              const mediaFetched = await ctx.getClient().downloadMedia(media.apiMedia)

              const mediaPath = join(userMediaPath, message.platformMessageId)
              logger.withFields({ mediaPath }).verbose('Media path')
              if (mediaFetched instanceof Buffer) {
                // write file to disk async
                void writeFile(mediaPath, mediaFetched)
              }

              return {
                apiMedia: media.apiMedia,
                media: mediaFetched,
              }
            }),
          )

          return {
            ...message,
            media: fetchedMedias,
          } satisfies CoreMessage
        }),
      )

      return Ok(resolvedMessages)
    },
  }
}
