import type { ReadMessageMediaInput } from '@tg-search/protocol'

import { Buffer } from 'node:buffer'

import { describe, expect, it, vi } from 'vitest'

import { createMessageMediaReader } from './message-media'

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
    const reader = createMessageMediaReader(async () => ({ type: 'document', mimeType: 'text/plain', size: bytes.length, read }))

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
    const reader = createMessageMediaReader(async () => ({ type: 'photo', size: 2, read: async () => Buffer.from('ab') }))
    expect(await reader(input)).toMatchObject({ offset: 0, nextOffset: null, contentStatus: 'complete' })
  })

  it('rejects oversized attachments before reading their content', async () => {
    const read = vi.fn(async () => Buffer.alloc(0))
    const reader = createMessageMediaReader(async () => ({ type: 'document', size: 101, read }))
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
    const reader = createMessageMediaReader(async () => ({ type: 'photo', size: 10, read: async () => Buffer.from('a') }))
    await expect(reader(input)).rejects.toThrow('incomplete media chunk')
  })

  it('does not reinterpret an unavailable local attachment as a live read', async () => {
    const resolve = vi.fn(async () => undefined)
    const reader = createMessageMediaReader(resolve)
    await expect(reader({ ...input, source: 'local' })).rejects.toThrow('not available from the selected source')
    expect(resolve).toHaveBeenCalledWith({ ...input, source: 'local' }, undefined)
  })
})
