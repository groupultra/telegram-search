import type { Logger } from '@guiiai/logg'
import type { ProxyConfig } from '@tg-search/common'
import type { Result } from '@unbird/result'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'

import type { CoreContext } from '../context'

import { isBrowser, parseProxyUrl } from '@tg-search/common'
import { Err, Ok } from '@unbird/result'
import { Api, TelegramClient } from 'telegram'
import { ConnectionTCPObfuscated } from 'telegram/network'
import { StringSession } from 'telegram/sessions'

import { CoreEventType } from '../types/events'
import { waitForEvent } from '../utils/promise'
import { signInWithQrCode, withLoginAbort } from './qr-login'

export type ConnectionService = ReturnType<typeof createConnectionService>

export function createConnectionService(ctx: CoreContext, logger: Logger, options: {
  apiId: number
  apiHash: string
  proxy?: ProxyConfig
}) {
  logger = logger.withContext('services:connection')

  function toProxyLogSummary(proxy: ProxyInterface) {
    return {
      ip: proxy.ip,
      port: proxy.port,
      socksType: 'socksType' in proxy ? proxy.socksType : undefined,
      isMTProxy: !!('MTProxy' in proxy && proxy.MTProxy),
      hasAuth: !!(('username' in proxy && proxy.username) || ('password' in proxy && proxy.password) || ('secret' in proxy && proxy.secret)),
      timeout: proxy.timeout,
    }
  }

  const getProxyInterface = (proxyConfig: ProxyConfig | undefined): ProxyInterface | undefined => {
    if (!proxyConfig || !proxyConfig.proxyUrl) {
      return undefined
    }

    const parsedProxy = parseProxyUrl(proxyConfig.proxyUrl)

    // Check if we have a valid proxy configuration
    if (!parsedProxy?.ip || !parsedProxy?.port) {
      return undefined
    }

    if (parsedProxy.MTProxy && parsedProxy.secret) {
      // MTProxy configuration
      return {
        ip: parsedProxy.ip,
        port: parsedProxy.port,
        MTProxy: true,
        secret: parsedProxy.secret,
        timeout: parsedProxy.timeout || 15, // Default timeout of 15 seconds
      }
    }

    // SOCKS proxy configuration
    return {
      ip: parsedProxy.ip,
      port: parsedProxy.port,
      socksType: parsedProxy.socksType || 5, // Default to SOCKS5
      timeout: parsedProxy.timeout || 15, // Default timeout of 15 seconds
      username: parsedProxy.username,
      password: parsedProxy.password,
    }
  }

  async function init(session?: StringSession | string): Promise<Result<TelegramClient>> {
    if (!options.apiId || !options.apiHash) {
      return Err(new Error('API ID and API Hash are required'))
    }

    const proxy = getProxyInterface(options.proxy)
    if (proxy) {
      logger.withFields({ proxy: toProxyLogSummary(proxy) }).verbose('Using proxy')
    }

    let useWSS = true

    // Use node and proxy
    if (!isBrowser() && proxy) {
      useWSS = false
    }

    if (!session) {
      session = new StringSession()
    }

    if (typeof session === 'string') {
      session = new StringSession(session)
    }

    const client = new TelegramClient(
      session,
      options.apiId,
      options.apiHash,
      {
        connectionRetries: 3,
        retryDelay: 10000,
        useWSS,
        proxy: isBrowser() ? undefined : proxy,
        connection: ConnectionTCPObfuscated,
      },
    )

    return Ok(client)
  }

  async function connectOrThrow(client: TelegramClient): Promise<void> {
    // TelegramClient owns connection retries and their delay. Racing it against
    // an unrelated timeout leaves a live connection attempt behind after the
    // caller has already treated it as failed.
    const isConnected = await client.connect()

    if (!isConnected) {
      throw new Error('Connected failed, check your internet connection and try again')
    }
  }

  let loginInFlight: Promise<Result<TelegramClient>> | undefined
  let qrLogin: { attemptId: string, controller: AbortController } | undefined
  let resolveQrPassword: ((password: string) => void) | undefined

  ctx.emitter.on(CoreEventType.AuthQrPassword, ({ attemptId, password }) => {
    if (qrLogin?.attemptId === attemptId && !qrLogin.controller.signal.aborted) {
      resolveQrPassword?.(password)
      resolveQrPassword = undefined
    }
  })

  ctx.emitter.on(CoreEventType.CoreCleanup, () => qrLogin?.controller.abort())

  async function cancelQrLogin(attemptId: string) {
    if (qrLogin?.attemptId !== attemptId)
      return
    qrLogin.controller.abort()
    await loginInFlight
  }

  async function loginWithQrCode(attemptId: string): Promise<Result<TelegramClient>> {
    if (qrLogin?.controller.signal.aborted)
      await loginInFlight
    if (loginInFlight) {
      if (qrLogin?.attemptId === attemptId)
        return loginInFlight
      ctx.emitter.emit(CoreEventType.AuthQrState, { attemptId, status: 'error' })
      return Err(new Error('Another login is already in progress'))
    }

    const controller = new AbortController()
    qrLogin = { attemptId, controller }
    return runLogin(async () => {
      let client: TelegramClient | undefined
      let retained = false
      let expired = false
      const { signal } = controller
      const timeout = setTimeout(() => {
        expired = true
        controller.abort()
      }, 5 * 60 * 1000)

      try {
        client = (await init()).expect('Failed to initialize Telegram client')
        signal.throwIfAborted()
        await withLoginAbort(connectOrThrow(client), signal)
        signal.throwIfAborted()
        await signInWithQrCode(client, options, {
          signal,
          qrCode: code => ctx.emitter.emit(CoreEventType.AuthQrCode, { attemptId, ...code }),
          passwordInvalid: () => ctx.emitter.emit(CoreEventType.AuthQrState, { attemptId, status: 'password-invalid' }),
          password: async () => {
            const password = new Promise<string>((resolve) => {
              resolveQrPassword = resolve
            })
            try {
              ctx.emitter.emit(CoreEventType.AuthQrState, { attemptId, status: 'password' })
              return await withLoginAbort(password, signal)
            }
            finally {
              resolveQrPassword = undefined
            }
          },
        })
        signal.throwIfAborted()
        const session = String(await client.session.save())
        signal.throwIfAborted()
        ctx.emitter.emit(CoreEventType.SessionUpdate, { session })
        ctx.setClient(client)
        retained = true
        ctx.emitter.emit(CoreEventType.AuthConnected)
        return Ok(client)
      }
      catch (error) {
        ctx.emitter.emit(CoreEventType.AuthQrState, {
          attemptId,
          status: expired ? 'expired' : signal.aborted ? 'cancelled' : 'error',
        })
        return Err(error instanceof Error ? error : new Error('QR login failed'))
      }
      finally {
        clearTimeout(timeout)
        if (!retained)
          await destroyCandidate(client)
        qrLogin = undefined
      }
    })
  }

  async function destroyCandidate(client: TelegramClient | undefined) {
    if (!client) {
      return
    }

    try {
      await client.destroy()
    }
    catch (error) {
      logger.withError(error).warn('Failed to destroy unsuccessful Telegram client')
    }
  }

  function runLogin(login: () => Promise<Result<TelegramClient>>): Promise<Result<TelegramClient>> {
    if (loginInFlight) {
      logger.verbose('Reusing in-flight Telegram login')
      return loginInFlight
    }

    loginInFlight = login().finally(() => {
      loginInFlight = undefined
    })
    return loginInFlight
  }

  async function loginWithSession(session: StringSession | string): Promise<Result<TelegramClient>> {
    return runLogin(async () => {
      let client: TelegramClient | undefined
      let retained = false

      try {
        client = (await init(session)).expect('Failed to initialize Telegram client')
        await connectOrThrow(client)

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          // Surface this as an auth-specific error so the frontend can fall
          // back to manual login and optionally clear the stored session.
          ctx.emitter.emit(CoreEventType.AuthError)
          ctx.emitter.emit(CoreEventType.AuthDisconnected)
          return Err(ctx.withError('User is not authorized'))
        }

        // NOTE: The client will return string session, so forward it to frontend
        const sessionString = String(await client.session.save())
        logger.withFields({ hasSession: !!sessionString }).verbose('Forwarding session to client')

        // 1) Forward updated session to frontend so it can persist it.
        ctx.emitter.emit(CoreEventType.SessionUpdate, { session: sessionString })

        // 2) Attach client to context for subsequent services.
        ctx.setClient(client)
        retained = true

        // 3) Finally signal that auth is connected; this will trigger
        //    afterConnectedEventHandler, which will establish current
        //    account ID and bootstrap dialogs/storage.
        ctx.emitter.emit(CoreEventType.AuthConnected)

        logger.log('Login with session successful')

        return Ok(client)
      }
      catch (error) {
        ctx.emitter.emit(CoreEventType.AuthError)
        return Err(ctx.withError(error, 'Failed to login with session'))
      }
      finally {
        if (!retained) {
          await destroyCandidate(client)
        }
      }
    })
  }

  async function loginWithPhone(phoneNumber: string): Promise<Result<TelegramClient>> {
    if (qrLogin?.controller.signal.aborted)
      await loginInFlight
    return runLogin(async () => {
      let client: TelegramClient | undefined
      let retained = false

      try {
        client = (await init()).expect('Failed to initialize Telegram client')
        await connectOrThrow(client)

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          await signIn(phoneNumber, client)
        }

        // NOTE: The client will return string session, so forward it to frontend
        const sessionString = String(await client.session.save())
        logger.withFields({ hasSession: !!sessionString }).verbose('Forwarding session to client')

        // 1) Forward updated session
        ctx.emitter.emit(CoreEventType.SessionUpdate, { session: sessionString })

        // 2) Attach client
        ctx.setClient(client)
        retained = true

        // 3) Notify connected; afterConnectedEventHandler will establish
        //    current account ID and bootstrap dialogs/storage.
        ctx.emitter.emit(CoreEventType.AuthConnected)

        logger.log('Login with phone successful')

        return Ok(client)
      }
      catch (error) {
        ctx.emitter.emit(CoreEventType.AuthError)
        return Err(ctx.withError(error, 'Failed to login with phone'))
      }
      finally {
        if (!retained) {
          await destroyCandidate(client)
        }
      }
    })
  }

  async function signIn(phoneNumber: string, client: TelegramClient): Promise<Api.TypeUser> {
    logger.withFields({ phoneNumber }).verbose('User is not authorized, signing in')

    return new Promise((resolve, reject) => {
      const apiUser = client.signInUser({
        apiId: options.apiId,
        apiHash: options.apiHash,
      }, {
        phoneNumber,
        phoneCode: async () => {
          logger.verbose('Waiting for code')
          ctx.emitter.emit(CoreEventType.AuthCodeNeeded)
          const { code } = await waitForEvent(ctx.emitter, CoreEventType.AuthCode)
          return code
        },
        password: async () => {
          logger.verbose('Waiting for password')
          ctx.emitter.emit(CoreEventType.AuthPasswordNeeded)
          const { password } = await waitForEvent(ctx.emitter, CoreEventType.AuthPassword)
          return password
        },
        onError: (error) => {
          ctx.emitter.emit(CoreEventType.AuthError)
          reject(ctx.withError(error, 'Failed to sign in to Telegram'))
        },
      })

      resolve(apiUser)
    })
  }

  async function logout(client: TelegramClient) {
    if (client.connected) {
      await client.invoke(new Api.auth.LogOut())
      await client.disconnect()
      ctx.emitter.emit(CoreEventType.AuthDisconnected)
    }

    client.session.delete()
    logger.verbose('Logged out from Telegram')
    return Ok(null)
  }

  return {
    loginWithQrCode,
    cancelQrLogin,
    loginWithPhone,
    loginWithSession,
    logout,
  }
}
