import { CoreEventType } from '@tg-search/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isEventaFrame, respondToReadyLogin, respondToSignInTicketRequest } from './app'

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

describe('respondToSignInTicketRequest', () => {
  const logger = { withError: () => ({ error: vi.fn() }) } as never
  const readyAccount = { accountReady: true, ctx: { getMyUser: () => ({ id: '987654321', name: 'Test User', username: 'test_user' }) } } as never

  it('issues a ticket for the Telegram user this session is logged in as', async () => {
    const issue = vi.fn(async () => 'ticket-value')
    await respondToSignInTicketRequest({} as never, readyAccount, issue, logger)
    // The identity comes from the authorized MTProto runtime, never from the request.
    expect(issue).toHaveBeenCalledWith({ telegramId: '987654321', name: 'Test User' })
    expect(sendWsEvent).toHaveBeenCalledWith(expect.anything(), 'server:sign-in-ticket', { ticket: 'ticket-value' })
  })

  it('refuses before the Telegram login completes and when OAuth is off', async () => {
    const issue = vi.fn(async () => 'ticket-value')
    await respondToSignInTicketRequest({} as never, { accountReady: false } as never, issue, logger)
    await respondToSignInTicketRequest({} as never, undefined, issue, logger)
    await respondToSignInTicketRequest({} as never, readyAccount, undefined, logger)
    expect(issue).not.toHaveBeenCalled()
    expect(sendWsEvent.mock.calls.map(([, , data]) => data)).toEqual([
      { error: 'ACCOUNT_NOT_READY' },
      { error: 'ACCOUNT_NOT_READY' },
      { error: 'OAUTH_DISABLED' },
    ])
  })

  it('reports a failed issue without exposing the cause', async () => {
    await respondToSignInTicketRequest({} as never, readyAccount, vi.fn(async () => {
      throw new Error('database unavailable')
    }), logger)
    expect(sendWsEvent).toHaveBeenCalledWith(expect.anything(), 'server:sign-in-ticket', { error: 'TICKET_FAILED' })
  })
})
