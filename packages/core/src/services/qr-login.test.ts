import type { TelegramClient } from 'telegram'

import { Buffer } from 'node:buffer'

import bigInt from 'big-integer'

import { Api } from 'telegram'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { signInWithQrCode } from './qr-login'

function setup() {
  const client = {
    invoke: vi.fn<TelegramClient['invoke']>(),
    _switchDC: vi.fn<TelegramClient['_switchDC']>().mockResolvedValue(true),
    addEventHandler: vi.fn<TelegramClient['addEventHandler']>(),
    removeEventHandler: vi.fn<TelegramClient['removeEventHandler']>(),
    signInWithPassword: vi.fn<TelegramClient['signInWithPassword']>(),
  }
  const controller = new AbortController()
  const options = {
    signal: controller.signal,
    qrCode: vi.fn(),
    password: vi.fn(async () => 'test-password'),
    passwordInvalid: vi.fn(),
  }
  const start = () => signInWithQrCode(client, { apiId: 1, apiHash: 'test-hash' }, options)
  return { client, controller, options, start }
}

function loginToken(seconds = 30) {
  return new Api.auth.LoginToken({ expires: Math.floor(Date.now() / 1000) + seconds, token: Buffer.from([251, 255]) })
}

afterEach(() => vi.useRealTimers())

describe('qR login protocol', () => {
  it('encodes base64url tokens, refreshes on expiry and removes timers and update handlers on cancellation', async () => {
    vi.useFakeTimers()
    const { client, controller, options, start } = setup()
    client.invoke.mockResolvedValue(loginToken())
    const login = start()
    const cancelled = expect(login).rejects.toThrow('cancelled')
    await vi.advanceTimersByTimeAsync(0)
    expect(options.qrCode).toHaveBeenCalledWith({ url: 'tg://login?token=-_8', expires: expect.any(Number) })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(client.invoke).toHaveBeenCalledTimes(2)
    controller.abort(new Error('cancelled'))
    await cancelled
    expect(vi.getTimerCount()).toBe(0)
    expect(client.removeEventHandler).toHaveBeenCalledWith(...client.addEventHandler.mock.calls[0]!)
  })

  it('finishes immediately on the Telegram login update and imports a token after DC migration', async () => {
    const { client, options, start } = setup()
    client.invoke.mockResolvedValueOnce(loginToken())
      .mockResolvedValueOnce(new Api.auth.LoginTokenMigrateTo({ dcId: 4, token: Buffer.from('migration') }))
      .mockResolvedValueOnce(new Api.auth.LoginTokenSuccess({ authorization: new Api.auth.Authorization({ user: new Api.UserEmpty({ id: bigInt(1) }) }) }))
    const login = start()
    await vi.waitFor(() => expect(options.qrCode).toHaveBeenCalledOnce())
    await client.addEventHandler.mock.calls[0]![0](new Api.UpdateLoginToken())
    await login
    expect(client._switchDC).toHaveBeenCalledWith(4)
    expect(client.invoke.mock.calls[2]![0]).toBeInstanceOf(Api.auth.ImportLoginToken)
    expect(client.removeEventHandler).toHaveBeenCalledOnce()
  })

  it('does not lose an acceptance update arriving while the token request is in flight', async () => {
    const { client, start } = setup()
    client.invoke.mockImplementationOnce(async () => {
      await client.addEventHandler.mock.calls[0]![0](new Api.UpdateLoginToken())
      return loginToken()
    }).mockResolvedValueOnce(new Api.auth.LoginTokenSuccess({ authorization: new Api.auth.Authorization({ user: new Api.UserEmpty({ id: bigInt(1) }) }) }))
    await start()
    expect(client.invoke).toHaveBeenCalledTimes(2)
  })

  it('requests two-factor authentication and allows only invalid-password errors to retry', async () => {
    const { client, options, start } = setup()
    client.invoke.mockRejectedValue(Object.assign(new Error('2FA'), { errorMessage: 'SESSION_PASSWORD_NEEDED' }))
    client.signInWithPassword.mockImplementation(async (_, auth) => {
      expect(await auth.password!()).toBe('test-password')
      expect(await auth.onError(Object.assign(new Error('invalid'), { errorMessage: 'PASSWORD_HASH_INVALID' }))).toBe(false)
      await expect(auth.onError(new Error('network failed'))).rejects.toThrow('network failed')
      return new Api.UserEmpty({ id: bigInt(1) })
    })
    await start()
    expect(options.passwordInvalid).toHaveBeenCalledOnce()
    expect(client.removeEventHandler).toHaveBeenCalledOnce()
  })

  it('ignores a late token response after cancellation', async () => {
    const { client, controller, options, start } = setup()
    let finish!: (value: Api.auth.LoginToken) => void
    client.invoke.mockImplementation(() => new Promise((resolve) => {
      finish = resolve
    }))
    const login = start()
    controller.abort(new Error('cancelled'))
    await expect(login).rejects.toThrow('cancelled')
    finish(loginToken())
    await Promise.resolve()
    expect(options.qrCode).not.toHaveBeenCalled()
    expect(client.removeEventHandler).toHaveBeenCalledOnce()
  })
})
