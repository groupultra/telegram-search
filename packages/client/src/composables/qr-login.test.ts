import { CoreEventType } from '@tg-search/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createQrLogin } from './qr-login'

afterEach(() => vi.useRealTimers())

describe('qR login client state', () => {
  it('offers retry if the server never returns a QR code and ignores its late response', () => {
    vi.useFakeTimers()
    const send = vi.fn()
    const qr = createQrLogin(send)
    qr.start()
    const attemptId = qr.state.attemptId
    vi.advanceTimersByTime(60_000)
    expect(qr.state.status).toBe('error')
    expect(send).toHaveBeenLastCalledWith(CoreEventType.AuthQrCancel, { attemptId })
    qr.receiveCode({ attemptId, url: 'tg://login?token=late', expires: 100 })
    qr.receiveState({ attemptId, status: 'cancelled' })
    expect(qr.state.status).toBe('error')
    expect(qr.state.url).toBe('')
  })
  it('cancels the previous attempt and ignores its late code, password and error events', () => {
    const send = vi.fn()
    const qr = createQrLogin(send)
    qr.start()
    const previous = qr.state.attemptId
    qr.start()
    const current = qr.state.attemptId
    expect(current).not.toBe(previous)
    expect(send.mock.calls).toEqual([
      [CoreEventType.AuthLogin, { qrAttemptId: previous }],
      [CoreEventType.AuthQrCancel, { attemptId: previous }],
      [CoreEventType.AuthLogin, { qrAttemptId: current }],
    ])
    qr.receiveCode({ attemptId: previous, url: 'tg://login?token=old', expires: 100 })
    qr.receiveState({ attemptId: previous, status: 'password' })
    qr.receiveState({ attemptId: previous, status: 'error' })
    expect(qr.state.status).toBe('loading')
    expect(qr.state.url).toBe('')
    qr.receiveCode({ attemptId: current, url: 'tg://login?token=new', expires: 200 })
    expect(qr.state.status).toBe('scanning')
    expect(qr.state.url).toBe('tg://login?token=new')
    qr.cancel()
    expect(qr.state.attemptId).toBe('')
    expect(qr.state.url).toBe('')
  })

  it('clears the QR token on 2FA, submits a scoped password and permits retry after a wrong password', () => {
    const inputs = { invalid: 'wrong', valid: 'correct' }
    const send = vi.fn()
    const qr = createQrLogin(send)
    qr.start()
    const attemptId = qr.state.attemptId
    qr.receiveCode({ attemptId, url: 'tg://login?token=test', expires: 100 })
    qr.receiveState({ attemptId, status: 'password' })
    expect(qr.state.url).toBe('')
    qr.submitPassword(inputs.invalid)
    expect(qr.state.status).toBe('submitting')
    expect(send).toHaveBeenLastCalledWith(CoreEventType.AuthQrPassword, { attemptId, password: inputs.invalid })
    qr.receiveState({ attemptId, status: 'password-invalid' })
    qr.receiveState({ attemptId, status: 'password' })
    expect(qr.state.passwordInvalid).toBe(true)
    qr.submitPassword(inputs.valid)
    expect(qr.state.passwordInvalid).toBe(false)
    expect(send).toHaveBeenLastCalledWith(CoreEventType.AuthQrPassword, { attemptId, password: inputs.valid })
    qr.clear()
    expect(qr.state.status).toBe('idle')
    expect(qr.state.attemptId).toBe('')
  })

  it('removes expired or failed QR codes', () => {
    const qr = createQrLogin(vi.fn())
    for (const status of ['error', 'expired'] as const) {
      qr.start()
      const attemptId = qr.state.attemptId
      qr.receiveCode({ attemptId, url: 'tg://login?token=test', expires: 100 })
      qr.receiveState({ attemptId, status })
      expect(qr.state.url).toBe('')
      expect(qr.state.status).toBe(status)
    }
  })
})
