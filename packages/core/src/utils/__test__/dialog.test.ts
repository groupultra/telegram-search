import bigInt from 'big-integer'

import { Api } from 'telegram'
import { describe, expect, it } from 'vitest'

import { getApiChatIdFromMtpPeer } from '../dialog'

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
