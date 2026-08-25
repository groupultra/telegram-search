import { CoreEventType } from '@tg-search/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isEventaFrame, respondToReadyLogin } from './app'

const sendWsEvent = vi.hoisted(() => vi.fn())

vi.mock('./events', () => ({ sendWsEvent }))

beforeEach(() => {
  sendWsEvent.mockClear()
})

describe('respondToReadyLogin', () => {
  it('replays account readiness without emitting a new auth login', () => {
    const peer = {} as never
    const account = {
      accountReady: true,
      ctx: { getCurrentAccountId: () => 'telegram-account-id' },
    } as never

    expect(respondToReadyLogin(peer, account)).toBe(true)
    expect(sendWsEvent).toHaveBeenCalledWith(peer, CoreEventType.AccountReady, { accountId: 'telegram-account-id' })
  })

  it('does not respond until the account is ready', () => {
    const peer = {} as never
    const account = { accountReady: false } as never

    expect(respondToReadyLogin(peer, account)).toBe(false)
    expect(sendWsEvent).not.toHaveBeenCalled()
  })
})

describe('isEventaFrame', () => {
  it('keeps legacy UI type/data messages out of the Eventa decoder', () => {
    // Before this guard, Eventa rejected this auth event and the login button
    // remained stuck in its loading state because the legacy handler was skipped.
    expect(isEventaFrame({ type: CoreEventType.AuthLogin, data: { phoneNumber: '123456' } })).toBe(false)
  })

  it('recognizes Eventa envelopes', () => {
    expect(isEventaFrame({ id: 'tg.v1.chats.list', body: {} })).toBe(true)
  })
})
