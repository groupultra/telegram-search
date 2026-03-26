import { Buffer } from 'node:buffer'

import bigInt from 'big-integer'

import { Api } from 'telegram'
import { describe, expect, it } from 'vitest'

import { getApiChatIdFromMtpPeer, resolveDialog, resolveDialogMessagePreview } from '../dialog'

describe('getApiChatIdFromMtpPeer', () => {
  it('should extract userId from InputPeerUser', () => {
    const peer = new Api.InputPeerUser({ userId: bigInt(123), accessHash: bigInt(456) })
    expect(getApiChatIdFromMtpPeer(peer)).toBe(123)
  })

  it('should extract userId from PeerUser', () => {
    const peer = new Api.PeerUser({ userId: bigInt(123) })
    expect(getApiChatIdFromMtpPeer(peer)).toBe(123)
  })

  it('should extract chatId from InputPeerChat', () => {
    const peer = new Api.InputPeerChat({ chatId: bigInt(123) })
    expect(getApiChatIdFromMtpPeer(peer)).toBe(123)
  })

  it('should extract chatId from PeerChat', () => {
    const peer = new Api.PeerChat({ chatId: bigInt(123) })
    expect(getApiChatIdFromMtpPeer(peer)).toBe(123)
  })

  it('should extract channelId from InputPeerChannel', () => {
    const peer = new Api.InputPeerChannel({ channelId: bigInt(123), accessHash: bigInt(456) })
    expect(getApiChatIdFromMtpPeer(peer)).toBe(123)
  })

  it('should extract channelId from PeerChannel', () => {
    const peer = new Api.PeerChannel({ channelId: bigInt(123) })
    expect(getApiChatIdFromMtpPeer(peer)).toBe(123)
  })

  it('should return undefined for InputPeerSelf', () => {
    const peer = new Api.InputPeerSelf()
    expect(getApiChatIdFromMtpPeer(peer)).toBeUndefined()
  })

  it('should return undefined for unknown peer types', () => {
    // @ts-expect-error - testing invalid input
    expect(getApiChatIdFromMtpPeer({})).toBeUndefined()
  })
})

describe('resolveDialogMessagePreview', () => {
  it('returns text content when present', () => {
    const message = new Api.Message({
      id: 1,
      message: 'hello world',
      date: 1,
    })

    expect(resolveDialogMessagePreview(message)).toBe('hello world')
  })

  it('returns sticker emoji when the last message is a sticker', () => {
    const message = new Api.Message({
      id: 1,
      message: '',
      date: 1,
      media: new Api.MessageMediaDocument({
        document: new Api.Document({
          id: bigInt(1),
          accessHash: bigInt(1),
          fileReference: Buffer.from([]),
          date: 1,
          mimeType: 'image/webp',
          size: bigInt(1),
          dcId: 1,
          attributes: [
            new Api.DocumentAttributeSticker({
              alt: '🙂',
              stickerset: new Api.InputStickerSetEmpty(),
            }),
          ],
        }),
      }),
    })

    expect(resolveDialogMessagePreview(message)).toBe('🙂')
  })

  it('returns media label when the last message is a photo', () => {
    const message = new Api.Message({
      id: 1,
      message: '',
      date: 1,
      media: new Api.MessageMediaPhoto({
        photo: new Api.Photo({
          id: bigInt(1),
          accessHash: bigInt(1),
          fileReference: Buffer.from([]),
          date: 1,
          sizes: [],
          dcId: 1,
        }),
      }),
    })

    expect(resolveDialogMessagePreview(message)).toBe('Photo')
  })

  it('returns service preview for pinned message actions', () => {
    const message = new Api.MessageService({
      id: 1,
      date: 1,
      action: new Api.MessageActionPinMessage(),
    })

    expect(resolveDialogMessagePreview(message)).toBe('Pinned a message')
  })
})

describe('resolveDialog', () => {
  it('returns channel metadata without swallowing normal entity fields', () => {
    const dialog = {
      isGroup: false,
      isChannel: true,
      isUser: false,
      name: 'Channel Name',
      entity: new Api.Channel({
        id: bigInt(123),
        title: 'Channel Name',
        accessHash: bigInt('987654321'),
        megagroup: true,
        username: 'channel_name',
        photo: new Api.ChatPhoto({ photoId: bigInt(456), dcId: 1 }),
        date: 1,
      }),
    } as any

    const result = resolveDialog(dialog).unwrap()

    expect(result).toEqual({
      id: 123,
      name: 'Channel Name',
      type: 'supergroup',
      isContact: false,
      avatarFileId: '456',
      avatarUpdatedAt: undefined,
      accessHash: '987654321',
      username: 'channel_name',
    })
  })
})
