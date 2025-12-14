import type { CoreDB, MediaBinaryLocation, MediaBinaryProvider, Models } from '@tg-search/core'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { useLogger } from '@guiiai/logg'
import { fileTypeFromBuffer } from 'file-type'
import { defineEventHandler, getRouterParam, H3, HTTPError } from 'h3'

export function v1api(db: CoreDB, models: Models, mediaBinaryProvider: MediaBinaryProvider | undefined): H3 {
  const app = new H3()

  app.get('/photos/:queryId', defineEventHandler(async (event) => {
    const queryId = getRouterParam(event, 'queryId')

    if (!queryId) {
      return new HTTPError('Query ID is required', { status: 400 })
    }

    try {
      const photo = (await models.photoModels.findPhotoByQueryId(db, queryId)).expect('Failed to find photo')

      useLogger('v1api:photos').withFields({ photo }).debug('Found photo')

      let bytes: Uint8Array | undefined

      useLogger('v1api:photos').withFields({ mediaBinaryProvider }).debug('Found media binary provider')

      if (mediaBinaryProvider && photo.image_path) {
        const location: MediaBinaryLocation = {
          kind: 'photo',
          path: photo.image_path,
        }
        bytes = await mediaBinaryProvider.load(location) ?? undefined
      }

      if (!bytes && photo.image_bytes) {
        bytes = new Uint8Array(photo.image_bytes as unknown as ArrayBufferLike)
      }

      if (!bytes || bytes.length === 0) {
        return new HTTPError('Photo not found', { status: 404 })
      }

      const fileType = photo.image_mime_type
        || (await fileTypeFromBuffer(bytes))?.mime
        || 'application/octet-stream'

      return new Response(Buffer.from(bytes), {
        headers: {
          'Content-Type': fileType,
          'Content-Length': bytes.length.toString(),
        },
      })
    }
    catch (error) {
      useLogger('v1api:photos').withError(error).error('Failed to find photo')
      return new HTTPError('Failed to find photo', { status: 500, cause: error })
    }
  }))

  app.get('/stickers/:queryId', defineEventHandler(async (event) => {
    const queryId = getRouterParam(event, 'queryId')

    if (!queryId) {
      return new HTTPError('Query ID is required', { status: 400 })
    }

    try {
      const sticker = (await models.stickerModels.findStickerByQueryId(db, queryId)).expect('Failed to find sticker')

      useLogger('v1api:stickers').withFields({ sticker }).debug('Found sticker')

      let bytes: Uint8Array | undefined

      useLogger('v1api:stickers').withFields({ mediaBinaryProvider }).debug('Found media binary provider')

      if (mediaBinaryProvider && sticker.sticker_path) {
        const location: MediaBinaryLocation = {
          kind: 'sticker',
          path: sticker.sticker_path,
        }
        bytes = await mediaBinaryProvider.load(location) ?? undefined
      }

      if (!bytes && sticker.sticker_bytes) {
        bytes = new Uint8Array(sticker.sticker_bytes as unknown as ArrayBufferLike)
      }

      if (!bytes || bytes.length === 0) {
        return new HTTPError('Sticker not found', { status: 404 })
      }

      const fileType = sticker.sticker_mime_type
        || (await fileTypeFromBuffer(bytes))?.mime
        || 'application/octet-stream'

      return new Response(Buffer.from(bytes), {
        headers: {
          'Content-Type': fileType,
          'Content-Length': bytes.length.toString(),
        },
      })
    }
    catch (error) {
      useLogger('v1api:stickers').withError(error).error('Failed to find sticker')
      return new HTTPError('Failed to find sticker', { status: 500, cause: error })
    }
  }))

  return app
}
