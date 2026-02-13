import type { CoreContext } from '../../context'

import { Buffer } from 'node:buffer'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { createMediaResolver } from '../media-resolver'

describe('media resolver', () => {
  it('keeps document type when direct download fallback succeeds', async () => {
    const client = {
      downloadMedia: vi.fn(async () => {
        throw new Error('downloadMedia blocked')
      }),
      downloadFile: vi.fn(async () => Buffer.from([0x00, 0x01, 0x02])),
    }

    const ctx = {
      getClient: () => client,
      getDB: () => ({}),
    } as unknown as CoreContext

    const photoModels = {
      findPhotoByFileIdWithMimeType: vi.fn(async () => ({ orUndefined: () => undefined })),
      recordPhotos: vi.fn(),
    } as any

    const stickerModels = {
      getStickerQueryIdByFileIdWithMimeType: vi.fn(async () => ({ orUndefined: () => undefined })),
      recordStickers: vi.fn(),
    } as any

    const resolver = createMediaResolver(ctx, useLogger(), photoModels, stickerModels, undefined)

    const document = new Api.Document({
      id: bigInt(101),
      accessHash: bigInt(202),
      fileReference: Buffer.from([0x01]),
      date: 0,
      mimeType: 'application/octet-stream',
      size: bigInt(3),
      dcId: 4,
      attributes: [],
    })

    const rawMessage = {
      media: new Api.MessageMediaDocument({
        document,
      }),
    } as Api.Message

    const coreMessage = {
      uuid: 'msg-1',
      media: [{
        type: 'document',
        platformId: '101',
      }],
    } as any

    const output: any[] = []
    for await (const message of resolver.stream!({
      messages: [coreMessage],
      rawMessages: [rawMessage],
      forceRefetch: true,
    })) {
      output.push(message)
    }

    const resolvedMedia = output[0].media[0]
    // Before the fix, this path downgraded to `unknown` even after successful document download.
    expect(resolvedMedia.type).toBe('document')
    expect(client.downloadMedia).toHaveBeenCalledTimes(1)
    expect(client.downloadFile).toHaveBeenCalledTimes(1)
    expect(client.downloadFile).toHaveBeenCalledWith(expect.any(Api.InputDocumentFileLocation), { dcId: 4 })
  })
})
