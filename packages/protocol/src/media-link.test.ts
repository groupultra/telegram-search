import { parse, safeParse } from 'valibot'
import { describe, expect, it } from 'vitest'

import { createMediaLinkInputSchema, mediaDownloadLinkSchema } from './media'
import { remoteMethods } from './remote'

describe('temporary media link contracts', () => {
  it('requires an explicit source and one message while applying bounded attachment defaults', () => {
    expect(parse(createMediaLinkInputSchema, { source: 'local', chatId: '42', messageId: '7' })).toEqual({
      source: 'local',
      chatId: '42',
      messageId: '7',
      mediaIndex: 0,
      maxBytes: 10 * 1024 * 1024,
    })
    for (const input of [
      { chatId: '42', messageId: '7' },
      { source: 'telegram', chatId: '42', messageId: '7', maxBytes: 50 * 1024 * 1024 + 1 },
      { source: 'telegram', chatId: '42', messageId: '0' },
      { source: 'telegram', chatId: '42', messageId: '7', mediaIndex: -1 },
      { source: 'telegram', chatId: 'x'.repeat(129), messageId: '7' },
    ]) {
      expect(safeParse(createMediaLinkInputSchema, input).success).toBe(false)
    }
    expect(remoteMethods['media.createLink'].input).toBe(createMediaLinkInputSchema)
  })

  it('only accepts a download path on the dedicated route, never an arbitrary URL or bearer', () => {
    const link = {
      path: '/v1/remote/media.download?ticket=synthetic_ticket-1',
      expiresAt: 1_800_000_000_000,
      media: { type: 'photo', size: 8, mimeType: 'image/jpeg' },
    }
    expect(parse(mediaDownloadLinkSchema, link)).toEqual(link)
    for (const path of [
      'https://untrusted.example/image.jpg',
      '//untrusted.example/image.jpg',
      '/v1/remote/media.download?token=long-lived-token',
      '/v1/remote/media.download?ticket=abc&accountId=other',
      '/v1/remote/messages.list?ticket=abc',
      '/v1/remote/media.download?ticket=',
    ]) {
      expect(safeParse(mediaDownloadLinkSchema, { ...link, path }).success).toBe(false)
    }
    expect(safeParse(mediaDownloadLinkSchema, { ...link, media: { type: 'photo', size: -1 } }).success).toBe(false)
  })
})
