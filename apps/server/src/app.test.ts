import { CoreEventType } from '@tg-search/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { respondToReadyLogin } from './app'

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
