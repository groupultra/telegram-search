import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { MediaBinaryProvider } from '@tg-search/core'

import { initLocalMediaStorage } from './local'
import { initMinioMediaStorage } from './minio'

let mediaStorage: MediaBinaryProvider | undefined

export async function initMediaStorage(logger: Logger, config: Config): Promise<MediaBinaryProvider | undefined> {
  mediaStorage = await initMinioMediaStorage(logger, config.minio)

  if (!mediaStorage) {
    mediaStorage = await initLocalMediaStorage(logger, config.media)
  }

  return mediaStorage
}

export function getMediaStorage(): MediaBinaryProvider | undefined {
  return mediaStorage
}
