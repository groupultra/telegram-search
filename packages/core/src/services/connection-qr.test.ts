import { Buffer } from 'node:buffer'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCoreContext } from '../context'
import { models } from '../models'
import { CoreEventType } from '../types/events'
import { createConnectionService } from './connection'

const user = new Api.UserEmpty({ id: bigInt(1) })
const success = new Api.auth.LoginTokenSuccess({ authorization: new Api.auth.Authorization({ user }) })

function setup() {
  const logger = useLogger('test:qr-login')
  const ctx = createCoreContext(() => {
    throw new Error('Unexpected database access')
  }, models, logger)
  const service = createConnectionService(ctx, logger, { apiId: 1, apiHash: 'test-hash' })
  const states = vi.fn()
  const sessions = vi.fn()
  const connected = vi.fn()
  ctx.emitter.on(CoreEventType.AuthQrState, states)
  ctx.emitter.on(CoreEventType.SessionUpdate, sessions)
  ctx.emitter.on(CoreEventType.AuthConnected, connected)
  return { ctx, service, states, sessions, connected }
}

beforeEach(() => {
  vi.spyOn(TelegramClient.prototype, 'connect').mockResolvedValue(true)
  vi.spyOn(TelegramClient.prototype, 'destroy').mockResolvedValue(undefined)
  vi.spyOn(StringSession.prototype, 'save').mockReturnValue('test-session')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('qR connection lifecycle', () => {
  it('publishes the session before connection readiness and retains the authorized client', async () => {
    vi.spyOn(TelegramClient.prototype, 'invoke').mockResolvedValue(success)
    const { ctx, service, sessions, connected } = setup()
    const result = await service.loginWithQrCode('first')
    expect(result.orUndefined()).toBe(ctx.getClient())
    expect(sessions).toHaveBeenCalledWith({ session: 'test-session' })
    expect(sessions.mock.invocationCallOrder[0]).toBeLessThan(connected.mock.invocationCallOrder[0]!)
    expect(TelegramClient.prototype.destroy).not.toHaveBeenCalled()
    ctx.cleanup()
  })

  it('rejects a competing attempt without cancelling the active scan', async () => {
    const invoke = vi.spyOn(TelegramClient.prototype, 'invoke').mockImplementation(() => new Promise(() => {}))
    const { ctx, service, states, sessions } = setup()
    const first = service.loginWithQrCode('first')
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce())
    const second = await service.loginWithQrCode('second')
    expect(second.orUndefined()).toBeUndefined()
    expect(states).toHaveBeenCalledWith({ attemptId: 'second', status: 'error' })
    await service.cancelQrLogin('second')
    expect(TelegramClient.prototype.destroy).not.toHaveBeenCalled()
    await service.cancelQrLogin('first')
    await first
    expect(sessions).not.toHaveBeenCalled()
    expect(TelegramClient.prototype.destroy).toHaveBeenCalledOnce()
    ctx.cleanup()
  })

  it('waits for cancellation cleanup before starting a replacement login', async () => {
    vi.spyOn(TelegramClient.prototype, 'invoke').mockResolvedValue(success)
    const { ctx, service, states, connected } = setup()
    const first = service.loginWithQrCode('first')
    const cancellation = service.cancelQrLogin('first')
    const second = service.loginWithQrCode('second')
    await Promise.all([first, cancellation, second])
    expect(states).toHaveBeenCalledWith({ attemptId: 'first', status: 'cancelled' })
    expect(connected).toHaveBeenCalledOnce()
    expect(TelegramClient.prototype.destroy).toHaveBeenCalledOnce()
    ctx.cleanup()
  })

  it('cancels during connection and cannot publish a late success', async () => {
    let finish!: (value: boolean) => void
    vi.mocked(TelegramClient.prototype.connect).mockImplementation(() => new Promise((resolve) => {
      finish = resolve
    }))
    const invoke = vi.spyOn(TelegramClient.prototype, 'invoke').mockResolvedValue(success)
    const { ctx, service, sessions, connected } = setup()
    const login = service.loginWithQrCode('first')
    await vi.waitFor(() => expect(TelegramClient.prototype.connect).toHaveBeenCalledOnce())
    await service.cancelQrLogin('first')
    finish(true)
    await login
    expect(invoke).not.toHaveBeenCalled()
    expect(sessions).not.toHaveBeenCalled()
    expect(connected).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(TelegramClient.prototype.destroy).toHaveBeenCalledTimes(2))
    ctx.cleanup()
  })

  it('expires abandoned scans after five minutes and destroys the candidate', async () => {
    vi.useFakeTimers()
    vi.spyOn(TelegramClient.prototype, 'invoke').mockImplementation(async () => new Api.auth.LoginToken({ token: Buffer.from('test'), expires: Date.now() / 1000 + 30 }))
    const { ctx, service, states, sessions } = setup()
    const login = service.loginWithQrCode('first')
    await vi.advanceTimersByTimeAsync(300_000)
    await login
    expect(states).toHaveBeenCalledWith({ attemptId: 'first', status: 'expired' })
    expect(sessions).not.toHaveBeenCalled()
    expect(TelegramClient.prototype.destroy).toHaveBeenCalledOnce()
    ctx.cleanup()
  })

  it('accepts only the current attempt password and releases its waiter during core cleanup', async () => {
    const inputs = { other: 'wrong-attempt', late: 'late' }
    vi.spyOn(TelegramClient.prototype, 'invoke').mockRejectedValue(Object.assign(new Error('2FA'), { errorMessage: 'SESSION_PASSWORD_NEEDED' }))
    const passwords: string[] = []
    vi.spyOn(TelegramClient.prototype, 'signInWithPassword').mockImplementation(async (_, auth) => {
      passwords.push(await auth.password!())
      return user
    })
    const { ctx, service, states, sessions } = setup()
    const login = service.loginWithQrCode('first')
    await vi.waitFor(() => expect(states).toHaveBeenCalledWith({ attemptId: 'first', status: 'password' }))
    ctx.emitter.emit(CoreEventType.AuthQrPassword, { attemptId: 'other', password: inputs.other })
    expect(passwords).toEqual([])
    ctx.emitter.emit(CoreEventType.CoreCleanup)
    await login
    ctx.emitter.emit(CoreEventType.AuthQrPassword, { attemptId: 'first', password: inputs.late })
    expect(passwords).toEqual([])
    expect(sessions).not.toHaveBeenCalled()
    expect(TelegramClient.prototype.destroy).toHaveBeenCalledOnce()
    ctx.cleanup()
  })

  it('completes two-factor login after the matching password event', async () => {
    const input = 'correct'
    vi.spyOn(TelegramClient.prototype, 'invoke').mockRejectedValue(Object.assign(new Error('2FA'), { errorMessage: 'SESSION_PASSWORD_NEEDED' }))
    vi.spyOn(TelegramClient.prototype, 'signInWithPassword').mockImplementation(async (_, auth) => {
      expect(await auth.password!()).toBe('correct')
      return user
    })
    const { ctx, service, states, connected } = setup()
    const login = service.loginWithQrCode('first')
    await vi.waitFor(() => expect(states).toHaveBeenCalledWith({ attemptId: 'first', status: 'password' }))
    ctx.emitter.emit(CoreEventType.AuthQrPassword, { attemptId: 'first', password: input })
    await login
    expect(connected).toHaveBeenCalledOnce()
    ctx.cleanup()
  })
})
