import { findPhotoByQueryId, findStickerByQueryId } from '@tg-search/core'
import { fileTypeFromBuffer } from 'file-type'
import { defineEventHandler, getRouterParam, H3, HTTPError } from 'h3'

import { getDb } from '../../db'

export function v1api(): H3 {
  const app = new H3()

  app.get('/photos/:queryId', defineEventHandler(async (event) => {
    const queryId = getRouterParam(event, 'queryId')

    if (!queryId) {
      return new HTTPError({
        statusCode: 400,
        statusMessage: 'Query ID is required',
      })
    }

    try {
      const photo = (await findPhotoByQueryId(getDb(), queryId)).expect('Failed to find photo')

      const bytes = new Uint8Array(photo?.image_bytes ?? new ArrayBuffer(0))
      if (bytes.length === 0) {
        return new HTTPError({
          statusCode: 404,
          statusMessage: 'Photo not found',
        })
      }

      const fileType = (await fileTypeFromBuffer(bytes))?.mime || 'application/octet-stream'

      return new Response(bytes, {
        headers: {
          'Content-Type': fileType,
          'Content-Length': bytes.length.toString(),
        },
      })
    }
    catch (error) {
      return new HTTPError({
        statusCode: 500,
        statusMessage: 'Failed to find photo',
        cause: error,
      })
    }
  }))

  app.get('/stickers/:queryId', defineEventHandler(async (event) => {
    const queryId = getRouterParam(event, 'queryId')

    if (!queryId) {
      return new HTTPError({
        statusCode: 400,
        statusMessage: 'Query ID is required',
      })
    }

    try {
      const sticker = (await findStickerByQueryId(getDb(), queryId)).expect('Failed to find sticker')

      const bytes = new Uint8Array(sticker?.sticker_bytes ?? new ArrayBuffer(0))
      if (bytes.length === 0) {
        return new HTTPError({
          statusCode: 404,
          statusMessage: 'Sticker not found',
        })
      }

      const fileType = (await fileTypeFromBuffer(bytes))?.mime || 'application/octet-stream'

      return new Response(bytes, {
        headers: {
          'Content-Type': fileType,
          'Content-Length': bytes.length.toString(),
        },
      })
    }
    catch (error) {
      return new HTTPError({
        statusCode: 500,
        statusMessage: 'Failed to find sticker',
        cause: error,
      })
    }
  }))

  return app
}
