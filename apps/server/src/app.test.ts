import { CoreEventType, uiNotificationContracts } from '@tg-search/core'
import { describe, expect, it, vi } from 'vitest'

import { isEventaFrameText, issueSignInTicketFor, limitNotificationSize, respondToReadyLogin } from './app'

describe('respondToReadyLogin', () => {
  it('replays account readiness without emitting a new auth login', () => {
    const eventa = { emit: vi.fn(async () => {}) }
    const account = {
      accountReady: true,
      ctx: { getCurrentAccountId: () => 'telegram-account-id' },
    } as never

    expect(respondToReadyLogin(eventa as never, account)).toBe(true)
    expect(eventa.emit).toHaveBeenCalledWith(uiNotificationContracts[CoreEventType.AccountReady], { accountId: 'telegram-account-id' })
  })

  it('does not respond until the account is ready', () => {
    const eventa = { emit: vi.fn(async () => {}) }

    expect(respondToReadyLogin(eventa as never, { accountReady: false } as never)).toBe(false)
    expect(eventa.emit).not.toHaveBeenCalled()
  })
})

describe('isEventaFrameText', () => {
  it('accepts Eventa frames and rejects legacy and malformed frames', () => {
    expect(isEventaFrameText('{"deliveryId":"d1","hopsRemaining":32,"eventa":{"id":"tg.ui.v1.command.message:read","body":{}}}')).toBe(true)
    // The legacy type/data envelope no longer has a path to core.
    expect(isEventaFrameText('{"type":"storage:record:dialogs","data":{"accountId":"","dialogs":[]}}')).toBe(false)
    expect(isEventaFrameText('not json')).toBe(false)
    expect(isEventaFrameText('null')).toBe(false)
  })
})

describe('limitNotificationSize', () => {
  it('keeps small payloads and drops oversized ones', () => {
    const small = { messages: [] }
    expect(limitNotificationSize(CoreEventType.MessageData, small)).toBe(small)
    const large = { messages: [{ content: 'x'.repeat(1024 * 1024) }] } as never
    expect(limitNotificationSize(CoreEventType.MessageData, large)).toBeUndefined()
  })
})

describe('issueSignInTicketFor', () => {
  const logger = { withError: () => ({ error: vi.fn() }) } as never
  const readyAccount = { accountReady: true, ctx: { getMyUser: () => ({ id: '987654321', name: 'Test User', username: 'test_user' }) } } as never

  it('issues a ticket for the Telegram user this session is logged in as', async () => {
    const issue = vi.fn(async () => 'ticket-value')
    // The identity comes from the authorized MTProto runtime, never from the request.
    expect(await issueSignInTicketFor(readyAccount, issue, logger)).toEqual({ ticket: 'ticket-value' })
    expect(issue).toHaveBeenCalledWith({ telegramId: '987654321', name: 'Test User' })
  })

  it('refuses before the Telegram login completes and when OAuth is off', async () => {
    const issue = vi.fn(async () => 'ticket-value')
    expect(await issueSignInTicketFor({ accountReady: false } as never, issue, logger)).toEqual({ error: 'ACCOUNT_NOT_READY' })
    expect(await issueSignInTicketFor(undefined, issue, logger)).toEqual({ error: 'ACCOUNT_NOT_READY' })
    expect(await issueSignInTicketFor(readyAccount, undefined, logger)).toEqual({ error: 'OAUTH_DISABLED' })
    expect(issue).not.toHaveBeenCalled()
  })

  it('reports a failed issue without exposing the cause', async () => {
    expect(await issueSignInTicketFor(readyAccount, vi.fn(async () => {
      throw new Error('database unavailable')
    }), logger)).toEqual({ error: 'TICKET_FAILED' })
  })
})
