import type { ReadMessageMediaInput } from '@tg-search/protocol'
import type { TelegramClient } from 'telegram'

import type { CoreDB } from '../db'
import type { Models } from '../models'

import { Buffer } from 'node:buffer'

import bigInt from 'big-integer'

import { Ok } from '@unbird/result'
import { Api } from 'telegram'
import { iterDownload } from 'telegram/client/downloads.js'
import { describe, expect, it, vi } from 'vitest'

import { withReadOperation } from '../application/read-operation'
import { createMessageMediaReader, createMessageMediaService } from './message-media'
import { createLocalMessageMediaSource, createTelegramMessageMediaSource } from './message-media-sources'

const input: ReadMessageMediaInput = { source: 'telegram', chatId: '42', messageId: '7', mediaIndex: 0, offset: 0, length: 4, maxBytes: 100 }

function fixture(chatId = '42', size = 10) {
  const document = new Api.Document({ id: bigInt(10), accessHash: bigInt(11), fileReference: Buffer.alloc(0), date: 1, mimeType: 'text/plain', size: bigInt(size), dcId: 1, attributes: [new Api.DocumentAttributeFilename({ fileName: 'fixture.txt' })] })
  const message = new Api.Message({ id: 7, peerId: new Api.PeerChannel({ channelId: bigInt(chatId) }), date: 1, message: '', media: new Api.MessageMediaDocument({ document }) })
  const close = vi.fn(async () => {})
  const getMessages = vi.fn(async () => [message])
  const iterDownload = vi.fn(() => ({
    close,
    async* [Symbol.asyncIterator]() { yield Buffer.from('abcd') },
  }))
  const peer = new Api.InputPeerChannel({ channelId: bigInt(42), accessHash: bigInt(1) })
  const resolve = createTelegramMessageMediaSource({ getMessages, iterDownload } as unknown as TelegramClient, async () => peer)
  return { resolve, getMessages, iterDownload, close }
}

describe('telegram attachment source', () => {
  it.each([
    { name: 'an irregular final chunk', offset: 64 * 1024, length: 256 * 1024, size: 64 * 1024 + 19001 },
    { name: 'an unaligned range across a megabyte boundary', offset: 1024 * 1024 - 97, length: 11003, size: 1024 * 1024 + 12000 },
    { name: 'a maximum chunk across a megabyte boundary', offset: 1024 * 1024 - 27, length: 256 * 1024, size: 1024 * 1024 + 300000 },
    { name: 'a one-byte range at an unaligned offset', offset: 1024 * 1024 + 3, length: 1, size: 1024 * 1024 + 100 },
  ])('returns exact bytes for $name using protocol-valid GramJS requests', async ({ offset, length, size }) => {
    // Rounding a short final range to 4 KiB alone produced LIMIT_INVALID.
    // Run the real SDK iterator against an offline transport enforcing Telegram's download constraints.
    const bytes = Buffer.from(Array.from({ length: size }, (_, index) => index % 251))
    const f = fixture('42', size)
    const requests: Array<{ offset: number, limit: number }> = []
    const client = {
      getMessages: f.getMessages,
      getSender: async (dcId: number) => ({ dcId }),
      _log: { info() {}, debug() {} },
      async invokeWithSender(request: Api.upload.GetFile) {
        const offset = request.offset.toJSNumber()
        const limit = request.limit
        if (offset % 4096 !== 0)
          throw new Error('OFFSET_INVALID')
        if (limit % 4096 !== 0 || (1024 * 1024) % limit !== 0)
          throw new Error('LIMIT_INVALID')
        if (Math.floor(offset / (1024 * 1024)) !== Math.floor((offset + limit - 1) / (1024 * 1024)))
          throw new Error('DOWNLOAD_RANGE_CROSSES_MEGABYTE')
        requests.push({ offset, limit })
        return new Api.upload.File({ type: new Api.storage.FileUnknown(), mtime: 0, bytes: bytes.subarray(offset, offset + limit) })
      },
      iterDownload(parameters: Parameters<TelegramClient['iterDownload']>[0]) {
        return iterDownload(this as unknown as TelegramClient, parameters)
      },
    }
    const source = createTelegramMessageMediaSource(client as unknown as TelegramClient, async () => new Api.InputPeerSelf())
    const result = await createMessageMediaReader(source)({ ...input, offset, length, maxBytes: size })
    const end = Math.min(offset + length, size)
    expect(Buffer.from(result.data, 'base64')).toEqual(bytes.subarray(offset, end))
    expect(result).toMatchObject({ size, offset, nextOffset: end === size ? null : end, contentStatus: 'partial' })
    expect(requests.length).toBeGreaterThan(0)
    if (offset < 1024 * 1024 && end > 1024 * 1024)
      expect(requests.some(request => request.offset === 1024 * 1024)).toBe(true)
  })

  it('uses an explicit message and closes a bounded download iterator', async () => {
    const f = fixture()
    const media = await f.resolve(input)
    expect(media).toMatchObject({ fileId: '10', type: 'document', size: 10, fileName: 'fixture.txt', mimeType: 'text/plain' })
    expect(Buffer.from(await media!.read(0, 4)).toString()).toBe('abcd')
    expect(f.iterDownload).toHaveBeenCalledWith(expect.objectContaining({ limit: 1, chunkSize: 4, requestSize: 4096 }))
    expect(f.close).toHaveBeenCalledOnce()
  })

  it('does not return an attachment from a different chat', async () => {
    const f = fixture('43')
    expect(await f.resolve(input)).toBeUndefined()
    expect(f.iterDownload).not.toHaveBeenCalled()
  })

  it('does not download an attachment just to list its metadata', async () => {
    const f = fixture()
    await f.resolve(input)
    expect(f.getMessages).toHaveBeenCalledOnce()
    expect(f.iterDownload).not.toHaveBeenCalled()
  })

  it('preserves a photo identity and its JPEG representation without downloading bytes', async () => {
    const f = fixture()
    const photo = new Api.Photo({ id: bigInt(21), accessHash: bigInt(22), fileReference: Buffer.alloc(0), date: 1, dcId: 1, sizes: [new Api.PhotoSize({ type: 'x', w: 10, h: 10, size: 15 })] })
    f.getMessages.mockResolvedValue([new Api.Message({ id: 7, peerId: new Api.PeerChannel({ channelId: bigInt(42) }), date: 1, message: '', media: new Api.MessageMediaPhoto({ photo }) })])
    expect(await f.resolve(input)).toMatchObject({ fileId: '21', type: 'photo', size: 15, mimeType: 'image/jpeg' })
    expect(f.iterDownload).not.toHaveBeenCalled()
  })

  it('bounds a stuck SDK download and reports that its RPC may continue', async () => {
    const f = fixture()
    f.iterDownload.mockReturnValue({
      close: f.close,
      async* [Symbol.asyncIterator]() {
        await new Promise(() => {})
        yield Buffer.alloc(0)
      },
    })
    const client = { getMessages: f.getMessages, iterDownload: f.iterDownload } as unknown as TelegramClient
    await expect(withReadOperation({ deadlineAt: Date.now() + 100 }, async (scope) => {
      const source = createTelegramMessageMediaSource(client, async () => new Api.InputPeerSelf(), scope)
      return createMessageMediaReader(source)(input, scope.signal)
    })).rejects.toMatchObject({ appError: { code: 'REQUEST_DEADLINE_EXCEEDED', details: { sdkCancellation: 'unsupported', inFlightMayContinue: true } } })
    expect(f.close).toHaveBeenCalledOnce()
  })

  it('does not turn an unavailable photo size into an empty successful download', async () => {
    // GramJS getFileInfo folds an unknown PhotoSizeEmpty into size 0.
    const f = fixture()
    const photo = new Api.Photo({ id: bigInt(1), accessHash: bigInt(2), fileReference: Buffer.alloc(0), date: 1, dcId: 1, sizes: [new Api.PhotoSizeEmpty({ type: 'x' })] })
    const message = new Api.Message({ id: 7, peerId: new Api.PeerChannel({ channelId: bigInt(42) }), date: 1, message: '', media: new Api.MessageMediaPhoto({ photo }) })
    f.getMessages.mockResolvedValue([message])
    await expect(f.resolve(input)).rejects.toThrow('Attachment size cannot be verified')
    expect(f.iterDownload).not.toHaveBeenCalled()
  })
})

describe('stored attachment identity', () => {
  it.each(['photo', 'sticker'] as const)('resolves a %s through an authorized message before returning its file ID and bytes', async (type) => {
    const bytes = Buffer.from('stored fixture')
    const fileId = `synthetic-${type}`
    const lookup = vi.fn(async () => Ok([{ id: 'stored-message', media: [{ type, platformId: fileId }] }]))
    const source = createLocalMessageMediaSource({
      db: {} as CoreDB,
      getAccountId: () => 'account-1',
      models: {
        chatMessageModels: { fetchMessagesByChatAndPlatformIds: lookup },
        photoModels: { findPhotosByMessageId: async () => Ok([{ file_id: fileId, image_bytes: bytes, image_mime_type: 'image/jpeg' }]) },
        stickerModels: { findStickerByFileId: async () => Ok({ sticker_bytes: bytes, sticker_mime_type: 'image/webp' }) },
      } as unknown as Models,
    })
    const service = createMessageMediaService(source)
    const request = { ...input, source: 'local' as const }
    const descriptor = { fileId, type, size: bytes.length, mimeType: type === 'photo' ? 'image/jpeg' : 'image/webp' }
    expect(await service.inspect(request)).toEqual(descriptor)
    expect(lookup).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'account-1', [{ chatId: '42', messageId: '7' }])
    expect(await service.download(request)).toEqual({ ...descriptor, bytes: new Uint8Array(bytes) })
    expect(lookup).toHaveBeenCalledTimes(2)
  })
})
