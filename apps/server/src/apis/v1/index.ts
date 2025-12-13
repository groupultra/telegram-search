import type { MediaBinaryLocation } from '@tg-search/core'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { findPhotoByQueryId, findStickerByQueryId, getMediaBinaryProvider } from '@tg-search/core'
import { fileTypeFromBuffer } from 'file-type'
import { defineEventHandler, getRouterParam, H3, HTTPError } from 'h3'

import { getDb } from '../../storage/drizzle'

export function v1api(): H3 {
  const app = new H3()

  app.get('/photos/:queryId', defineEventHandler(async (event) => {
    const queryId = getRouterParam(event, 'queryId')

    if (!queryId) {
      throw new HTTPError('Query ID is required', { status: 400 })
    }

    try {
      const photo = (await findPhotoByQueryId(getDb(), queryId)).expect('Failed to find photo')

      const provider = getMediaBinaryProvider()
      let bytes: Uint8Array | undefined

      if (provider && photo.image_path) {
        const location: MediaBinaryLocation = {
          kind: 'photo',
          path: photo.image_path,
        }
        bytes = await provider.load(location) ?? undefined
      }

      if (!bytes && photo.image_bytes) {
        bytes = new Uint8Array(photo.image_bytes as unknown as ArrayBufferLike)
      }

      if (!bytes || bytes.length === 0) {
        throw new HTTPError('Photo not found', { status: 404 })
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
      throw new HTTPError('Failed to find photo', { status: 500, cause: error })
    }
  }))

  app.get('/stickers/:queryId', defineEventHandler(async (event) => {
    const queryId = getRouterParam(event, 'queryId')

    if (!queryId) {
      throw new HTTPError('Query ID is required', { status: 400 })
    }

    try {
      const sticker = (await findStickerByQueryId(getDb(), queryId)).expect('Failed to find sticker')

      const provider = getMediaBinaryProvider()
      let bytes: Uint8Array | undefined

      if (provider && sticker.sticker_path) {
        const location: MediaBinaryLocation = {
          kind: 'sticker',
          path: sticker.sticker_path,
        }
        bytes = await provider.load(location) ?? undefined
      }

      if (!bytes && sticker.sticker_bytes) {
        bytes = new Uint8Array(sticker.sticker_bytes as unknown as ArrayBufferLike)
      }

      if (!bytes || bytes.length === 0) {
        throw new HTTPError('Sticker not found', { status: 404 })
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
      throw new HTTPError('Failed to find sticker', { status: 500, cause: error })
    }
  }))

  return app
}
