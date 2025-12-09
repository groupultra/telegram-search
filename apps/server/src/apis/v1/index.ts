import { findPhotoByFileId } from '@tg-search/core'
import { fileTypeFromBuffer } from 'file-type'
import { defineEventHandler, getRouterParam, H3, HTTPError } from 'h3'

import { getDb } from '../../db'

export function v1api(): H3 {
  const app = new H3()

  app.all('/photos/:id', defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
      return new HTTPError({
        statusCode: 400,
        statusMessage: 'File ID is required',
      })
    }

    try {
      const photo = (await findPhotoByFileId(getDb(), id)).expect('Failed to find photo')

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

  return app
}
