import { EventEmitter } from 'eventemitter3'
import { Api } from 'telegram'
import { RPCError } from 'telegram/errors'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CoreEventType } from '../types/events'
import { createConnectionService } from './connection'

const telegramMock = vi.hoisted(() => {
  const clients: TelegramClient[] = []
  const nextConnect: Array<() => Promise<boolean>> = []
  const nextAuthorization: boolean[] = []
  const nextStateErrors: Error[] = []
  const nextDestroy: Array<() => Promise<void>> = []

  class TelegramClient {
    connected = false
    connect: ReturnType<typeof vi.fn>
    isUserAuthorized: ReturnType<typeof vi.fn>
    invoke: ReturnType<typeof vi.fn>
    signInUser: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    session: { save: ReturnType<typeof vi.fn> }

    constructor() {
      this.connect = vi.fn(nextConnect.shift() ?? (async () => true))
      this.isUserAuthorized = vi.fn(async () => nextAuthorization.shift() ?? true)
      this.invoke = vi.fn(async () => {
        const error = nextStateErrors.shift()
        if (error)
          throw error
      })
      this.signInUser = vi.fn()
      this.destroy = vi.fn(nextDestroy.shift() ?? (async () => undefined))
      this.session = { save: vi.fn(async () => 'saved-session') }
      clients.push(this)
    }
  }

  return { clients, nextAuthorization, nextConnect, nextStateErrors, nextDestroy, TelegramClient }
})

vi.mock('telegram', () => ({
  Api: { auth: { LogOut: class {} }, updates: { GetState: class {} } },
  TelegramClient: telegramMock.TelegramClient,
}))

vi.mock('telegram/network', () => ({ ConnectionTCPObfuscated: class {} }))

vi.mock('telegram/sessions', () => ({
  StringSession: class {
    constructor(_session?: string) {}
  },
}))

function createContext() {
  const emitter = new EventEmitter()
  return {
    emitter,
    setClient: vi.fn(),
    withError: vi.fn((error: unknown) => error instanceof Error ? error : new Error(String(error))),
  }
}

const logger = {
  withContext: vi.fn(),
  withFields: vi.fn(),
  verbose: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  withError: vi.fn(),
}
logger.withContext.mockReturnValue(logger)
logger.withFields.mockReturnValue(logger)
logger.withError.mockReturnValue(logger)

function createService() {
  const ctx = createContext()
  const service = createConnectionService(ctx as never, logger as never, { apiId: 1, apiHash: 'hash' })
  return { ctx, service }
}

afterEach(() => {
  telegramMock.clients.length = 0
  telegramMock.nextAuthorization.length = 0
  telegramMock.nextConnect.length = 0
  telegramMock.nextStateErrors.length = 0
  telegramMock.nextDestroy.length = 0
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('connection service login lifecycle', () => {
  it('notifies recovery only after slow failed-login cleanup has finished', async () => {
    vi.useFakeTimers()
    const { ctx, service } = createService()
    const authError = vi.fn(() => {
      setTimeout(() => {
        void service.loginWithSession('session')
      }, 2000)
    })
    ctx.emitter.on(CoreEventType.AuthError, authError)
    telegramMock.nextConnect.push(async () => {
      throw new Error('network failed')
    })
    telegramMock.nextDestroy.push(() => new Promise(resolve => setTimeout(resolve, 5000)))
    const first = service.loginWithSession('session')
    await vi.advanceTimersByTimeAsync(4000)
    expect(authError).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3000)
    await first
    expect(telegramMock.clients).toHaveLength(2)
    expect(ctx.setClient).toHaveBeenCalledWith(telegramMock.clients[1])
  })
  it('allows Telegram client retries to complete after the former five-second deadline', async () => {
    vi.useFakeTimers()
    const { ctx, service } = createService()
    telegramMock.nextConnect.push(() => new Promise(resolve => setTimeout(() => resolve(true), 5_100)))
    const login = service.loginWithSession('session')

    await vi.advanceTimersByTimeAsync(5_100)

    expect((await login).orUndefined()).toBe(telegramMock.clients[0])
    expect(ctx.setClient).toHaveBeenCalledTimes(1)
  })

  it('destroys a client when connecting fails', async () => {
    const { service } = createService()
    telegramMock.nextConnect.push(async () => {
      throw new Error('network failed')
    })
    const login = service.loginWithSession('session')

    expect((await login).orUndefined()).toBeUndefined()
    expect(telegramMock.clients[0]!.destroy).toHaveBeenCalledOnce()
  })

  it('returns an error and destroys a client when connect reports false', async () => {
    const { service } = createService()
    telegramMock.nextConnect.push(async () => false)

    const result = await service.loginWithSession('session')

    expect(result.orUndefined()).toBeUndefined()
    expect(telegramMock.clients[0]!.destroy).toHaveBeenCalledOnce()
  })

  it('destroys an unauthorized session client', async () => {
    const { service, ctx } = createService()
    const disconnected = vi.fn()
    ctx.emitter.on(CoreEventType.AuthDisconnected, disconnected)
    telegramMock.nextAuthorization.push(false)
    telegramMock.nextStateErrors.push(new RPCError('AUTH_KEY_UNREGISTERED', new Api.updates.GetState(), 401))
    const login = service.loginWithSession('session')

    expect((await login).orUndefined()).toBeUndefined()
    expect(telegramMock.clients[0]!.destroy).toHaveBeenCalledOnce()
    expect(disconnected).toHaveBeenCalledOnce()
  })

  it('preserves the distinction between a failed authorization request and a revoked session', async () => {
    const { service, ctx } = createService()
    const disconnected = vi.fn()
    const authError = vi.fn()
    ctx.emitter.on(CoreEventType.AuthDisconnected, disconnected)
    ctx.emitter.on(CoreEventType.AuthError, authError)
    telegramMock.nextStateErrors.push(new Error('TIMEOUT'))
    telegramMock.nextAuthorization.push(false)

    await service.loginWithSession('session')

    expect(authError).toHaveBeenCalledOnce()
    expect(disconnected).not.toHaveBeenCalled()
    expect(ctx.setClient).not.toHaveBeenCalled()
    expect(telegramMock.clients[0]!.destroy).toHaveBeenCalledOnce()
  })

  it('keeps a client retained after AuthConnected handling throws', async () => {
    const { ctx, service } = createService()
    ctx.emitter.on(CoreEventType.AuthConnected, () => {
      throw new Error('bootstrap failed')
    })

    const result = await service.loginWithSession('session')

    expect(result.orUndefined()).toBeUndefined()
    expect(ctx.setClient).toHaveBeenCalledWith(telegramMock.clients[0])
    expect(telegramMock.clients[0]!.destroy).not.toHaveBeenCalled()
  })

  it('shares one login attempt across session and phone entry points', async () => {
    const { ctx, service } = createService()
    const first = service.loginWithSession('session')
    const second = service.loginWithPhone('+15555550123')

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(telegramMock.clients).toHaveLength(1)
    expect(ctx.setClient).toHaveBeenCalledOnce()
  })
})
