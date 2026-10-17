import type { ReadMessageMediaInput } from '@tg-search/protocol'

import { Buffer } from 'node:buffer'

import { MEDIA_CHUNK_BYTES } from '@tg-search/protocol'
import { describe, expect, it, vi } from 'vitest'

import { withReadOperation } from '../application/read-operation'
import { createMessageMediaReader, createMessageMediaService } from './message-media'

const input: ReadMessageMediaInput = {
  source: 'telegram',
  chatId: '42',
  messageId: '7',
  mediaIndex: 0,
  offset: 0,
  length: 4,
  maxBytes: 100,
}

describe('bounded message media reads', () => {
  it('returns bounded chunks with an honest continuation offset', async () => {
    // A binary response must stay below the IPC frame budget, not contain the whole attachment.
    const bytes = Buffer.from('abcdefghij')
    const read = vi.fn(async (offset: number, length: number) => bytes.subarray(offset, offset + length))
    const reader = createMessageMediaReader(async () => ({ fileId: 'synthetic-file', type: 'document', mimeType: 'text/plain', size: bytes.length, read }))

    const first = await reader(input)
    expect(Buffer.from(first.data, 'base64').toString()).toBe('abcd')
    expect(first.nextOffset).toBe(4)
    expect(first.contentStatus).toBe('partial')
    const last = await reader({ ...input, offset: 8 })
    expect(Buffer.from(last.data, 'base64').toString()).toBe('ij')
    expect(last.nextOffset).toBeNull()
    expect(last.contentStatus).toBe('partial')
    expect(read.mock.calls).toEqual([[0, 4, undefined], [8, 2, undefined]])
  })

  it('only reports complete content when the returned range covers the whole attachment', async () => {
    const reader = createMessageMediaReader(async () => ({ fileId: 'synthetic-file', type: 'photo', size: 2, read: async () => Buffer.from('ab') }))
    expect(await reader(input)).toMatchObject({ offset: 0, nextOffset: null, contentStatus: 'complete' })
  })

  it('rejects oversized attachments before reading their content', async () => {
    const read = vi.fn(async () => Buffer.alloc(0))
    const reader = createMessageMediaReader(async () => ({ fileId: 'synthetic-file', type: 'document', size: 101, read }))
    await expect(reader(input)).rejects.toThrow('exceeds the requested byte limit')
    expect(read).not.toHaveBeenCalled()
  })

  it('does not resolve or download a cancelled operation', async () => {
    const resolve = vi.fn()
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    const reader = createMessageMediaReader(resolve)
    await expect(reader(input, controller.signal)).rejects.toThrow('cancelled')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('fails on truncated content instead of claiming completion', async () => {
    const reader = createMessageMediaReader(async () => ({ fileId: 'synthetic-file', type: 'photo', size: 10, read: async () => Buffer.from('a') }))
    await expect(reader(input)).rejects.toThrow('incomplete media chunk')
  })

  it('does not reinterpret an unavailable local attachment as a live read', async () => {
    const resolve = vi.fn(async () => undefined)
    const reader = createMessageMediaReader(resolve)
    await expect(reader({ ...input, source: 'local' })).rejects.toThrow('not available from the selected source')
    expect(resolve).toHaveBeenCalledWith({ ...input, source: 'local' }, undefined)
  })
})

describe('raw message media inspection and download', () => {
  const descriptor = { fileId: 'synthetic-file', type: 'document', mimeType: 'application/octet-stream', fileName: 'fixture.bin' }

  it('inspects identity and metadata without reading any content or changing the selected source', async () => {
    const read = vi.fn(async () => new Uint8Array())
    const resolve = vi.fn(async () => ({ ...descriptor, size: 7, read }))
    const request = { ...input, source: 'local' as const }
    expect(await createMessageMediaService(resolve).inspect(request)).toEqual({ ...descriptor, size: 7 })
    expect(resolve).toHaveBeenCalledExactlyOnceWith(request, undefined)
    expect(read).not.toHaveBeenCalled()
  })

  it.each(['read', 'inspect', 'download'] as const)('rejects an over-budget attachment before %s reads bytes', async (method) => {
    const read = vi.fn(async () => new Uint8Array())
    const service = createMessageMediaService(async () => ({ ...descriptor, size: input.maxBytes + 1, read }))
    await expect(service[method](input)).rejects.toMatchObject({ appError: { code: 'MEDIA_TOO_LARGE' } })
    expect(read).not.toHaveBeenCalled()
  })

  it('resolves once and assembles the full file using bounded ranges without base64', async () => {
    const bytes = Uint8Array.from({ length: MEDIA_CHUNK_BYTES + 31 }, (_, index) => index % 251)
    const read = vi.fn(async (offset: number, length: number) => bytes.subarray(offset, offset + length))
    const resolve = vi.fn(async () => ({ ...descriptor, size: bytes.length, read }))
    // Complete downloads always cover the file; chunk-read offset/length are not a partial download request.
    const result = await createMessageMediaService(resolve).download({ ...input, offset: 3, length: 1, maxBytes: bytes.length })
    expect(result).toEqual({ ...descriptor, size: bytes.length, bytes })
    expect(result.bytes).toBeInstanceOf(Uint8Array)
    expect(resolve).toHaveBeenCalledOnce()
    expect(read.mock.calls).toEqual([[0, MEDIA_CHUNK_BYTES, undefined], [MEDIA_CHUNK_BYTES, 31, undefined]])
  })

  it('returns an empty file without issuing a zero-length source read', async () => {
    const read = vi.fn(async () => new Uint8Array())
    const result = await createMessageMediaService(async () => ({ ...descriptor, size: 0, read })).download(input)
    expect(result).toEqual({ ...descriptor, size: 0, bytes: new Uint8Array() })
    expect(read).not.toHaveBeenCalled()
  })

  it.each([Number.NaN, -1, Number.MAX_SAFE_INTEGER + 1])('rejects an unverifiable file size (%s)', async (size) => {
    const read = vi.fn(async () => new Uint8Array())
    const service = createMessageMediaService(async () => ({ ...descriptor, size, read }))
    await expect(service.inspect(input)).rejects.toMatchObject({ appError: { code: 'MEDIA_SIZE_UNKNOWN' } })
    await expect(service.download(input)).rejects.toMatchObject({ appError: { code: 'MEDIA_SIZE_UNKNOWN' } })
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects a short final range rather than returning a partially assembled file', async () => {
    const size = MEDIA_CHUNK_BYTES + 17
    const read = vi.fn(async (_offset: number, length: number) => new Uint8Array(length === 17 ? 16 : length))
    await expect(createMessageMediaService(async () => ({ ...descriptor, size, read })).download({ ...input, maxBytes: size }))
      .rejects
      .toMatchObject({ appError: { code: 'MEDIA_INCOMPLETE' } })
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('stops before requesting another range when cancelled during a download', async () => {
    const controller = new AbortController()
    const size = MEDIA_CHUNK_BYTES + 17
    const read = vi.fn(async (_offset: number, length: number) => {
      controller.abort(new Error('synthetic cancellation'))
      return new Uint8Array(length)
    })
    await expect(createMessageMediaService(async () => ({ ...descriptor, size, read })).download({ ...input, maxBytes: size }, controller.signal))
      .rejects
      .toThrow('synthetic cancellation')
    expect(read).toHaveBeenCalledOnce()
  })

  it.each(['inspect', 'download'] as const)('does not resolve media when %s is already cancelled', async (method) => {
    const controller = new AbortController()
    controller.abort(new Error('synthetic cancellation'))
    const resolve = vi.fn()
    await expect(createMessageMediaService(resolve)[method](input, controller.signal)).rejects.toThrow('synthetic cancellation')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('keeps one deadline across a stuck range and never starts a later range', async () => {
    const size = MEDIA_CHUNK_BYTES + 17
    let settle!: (value: Uint8Array) => void
    const read = vi.fn(() => new Promise<Uint8Array>((resolve) => {
      settle = resolve
    }))
    const service = createMessageMediaService(async () => ({ ...descriptor, size, read }))
    await expect(withReadOperation({ deadlineAt: Date.now() + 30 }, scope => service.download({ ...input, maxBytes: size }, scope.signal)))
      .rejects
      .toMatchObject({ appError: { code: 'REQUEST_DEADLINE_EXCEEDED' } })
    settle(new Uint8Array(MEDIA_CHUNK_BYTES))
    await new Promise<void>(resolve => queueMicrotask(resolve))
    expect(read).toHaveBeenCalledOnce()
  })
})
