import type { ReadMessageMediaInput } from '@tg-search/protocol'
import type { TelegramClient } from 'telegram'

import { Buffer } from 'node:buffer'

import bigInt from 'big-integer'

import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { withReadOperation } from '../application/read-operation'
import { createMessageMediaReader } from './message-media'
import { createTelegramMessageMediaSource } from './message-media-sources'

const input: ReadMessageMediaInput = { source: 'telegram', chatId: '42', messageId: '7', mediaIndex: 0, offset: 0, length: 4, maxBytes: 100 }

function fixture(chatId = '42') {
  const document = new Api.Document({ id: bigInt(10), accessHash: bigInt(11), fileReference: Buffer.alloc(0), date: 1, mimeType: 'text/plain', size: bigInt(10), dcId: 1, attributes: [new Api.DocumentAttributeFilename({ fileName: 'fixture.txt' })] })
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
  it('uses an explicit message and closes a bounded download iterator', async () => {
    const f = fixture()
    const media = await f.resolve(input)
    expect(media).toMatchObject({ type: 'document', size: 10, fileName: 'fixture.txt', mimeType: 'text/plain' })
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
