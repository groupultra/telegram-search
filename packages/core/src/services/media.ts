import type { Api } from 'telegram'
import type { CoreContext } from '../context'

import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { useLogger } from '@tg-search/common'
import { getMediaPath, useConfig } from '@tg-search/common/composable'

export interface MediaEventToCore {
  'media:fetch': (data: { messages: Api.Message[] }) => void
}

export interface MediaEventFromCore {
  'media:data': (data: {
    message: Api.Message
    path: string
    media: string | Buffer<ArrayBufferLike> | undefined
  }) => void
}

export type MediaEvent = MediaEventFromCore & MediaEventToCore

export type MediaService = ReturnType<typeof createMediaService>

export function createMediaService(ctx: CoreContext) {
  const { emitter, getClient } = ctx
  const mediaPath = getMediaPath(useConfig().path.storage)

  async function useUserMediaPath() {
    const userId = (await getClient().getMe()).id.toString()
    const userMediaPath = join(mediaPath, userId)
    if (!existsSync(userMediaPath)) {
      mkdirSync(userMediaPath, { recursive: true })
    }

    return userMediaPath
  }

  async function fetchMedia(messages: Api.Message[]) {
    messages.map(async (message) => {
      const media = message.media

      if (!media) {
        return
      }

      const peerId = message.peerId
      const userMediaPath = join(await useUserMediaPath(), peerId.toString())
      if (!existsSync(userMediaPath)) {
        mkdirSync(userMediaPath, { recursive: true })
      }

      const mediaFetched = await getClient().downloadMedia(media)

      const mediaPath = join(userMediaPath, message.id.toString())
      useLogger().withFields({ mediaPath }).verbose('Media path')
      if (mediaFetched instanceof Buffer) {
        // write file to disk async
        void writeFile(mediaPath, mediaFetched)
      }

      emitter.emit('media:data', {
        message,
        path: mediaPath,
        media: mediaFetched,
      })
    })
  }

  return {
    fetchMedia,
  }
}
