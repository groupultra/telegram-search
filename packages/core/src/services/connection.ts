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

import { waitForEvent } from '../utils/promise'

export type ConnectionService = ReturnType<ReturnType<typeof createConnectionService>>

export function createConnectionService(ctx: CoreContext, logger: Logger) {
  return function (options: {
    apiId: number
    apiHash: string
    proxy?: ProxyConfig
  }) {
    logger = logger.withContext('services:connection')

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
        logger.withFields({ proxy }).verbose('Using proxy')
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
      const CONNECT_TIMEOUT = 5000

      const isConnected = await Promise.race<boolean>([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to Telegram, check your internet connection and try again')), CONNECT_TIMEOUT)),
      ])

      if (!isConnected) {
        throw new Error('Connected failed, check your internet connection and try again')
      }
    }

    async function loginWithSession(session: StringSession | string): Promise<Result<TelegramClient>> {
      try {
        const client = (await init(session)).expect('Failed to initialize Telegram client')
        await connectOrThrow(client)

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          // Surface this as an auth-specific error so the frontend can fall
          // back to manual login and optionally clear the stored session.
          ctx.emitter.emit('auth:error')
          ctx.emitter.emit('auth:disconnected')
          return Err(ctx.withError('User is not authorized'))
        }

        // NOTE: The client will return string session, so forward it to frontend
        const sessionString = await client.session.save() as unknown as string
        logger.withFields({ hasSession: !!sessionString }).verbose('Forwarding session to client')

        // 1) Forward updated session to frontend so it can persist it.
        ctx.emitter.emit('session:update', { session: sessionString })

        // 2) Attach client to context for subsequent services.
        ctx.setClient(client)

        // 3) Finally signal that auth is connected; this will trigger
        //    afterConnectedEventHandler, which will establish current
        //    account ID and bootstrap dialogs/storage.
        ctx.emitter.emit('auth:connected')

        logger.log('Login with session successful')

        return Ok(client)
      }
      catch (error) {
        ctx.emitter.emit('auth:error')
        return Err(ctx.withError(error, 'Failed to login with session'))
      }
    }

    async function loginWithPhone(phoneNumber: string): Promise<Result<TelegramClient>> {
      try {
        const client = (await init()).expect('Failed to initialize Telegram client')
        await connectOrThrow(client)

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          await signIn(phoneNumber, client)
        }

        // NOTE: The client will return string session, so forward it to frontend
        const sessionString = await client.session.save() as unknown as string
        logger.withFields({ hasSession: !!sessionString }).verbose('Forwarding session to client')

        // 1) Forward updated session
        ctx.emitter.emit('session:update', { session: sessionString })

        // 2) Attach client
        ctx.setClient(client)

        // 3) Notify connected; afterConnectedEventHandler will establish
        //    current account ID and bootstrap dialogs/storage.
        ctx.emitter.emit('auth:connected')

        logger.log('Login with phone successful')

        return Ok(client)
      }
      catch (error) {
        ctx.emitter.emit('auth:error')
        return Err(ctx.withError(error, 'Failed to login with phone'))
      }
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
            ctx.emitter.emit('auth:code:needed')
            const { code } = await waitForEvent(ctx.emitter, 'auth:code')
            return code
          },
          password: async () => {
            logger.verbose('Waiting for password')
            ctx.emitter.emit('auth:password:needed')
            const { password } = await waitForEvent(ctx.emitter, 'auth:password')
            return password
          },
          onError: (error) => {
            ctx.emitter.emit('auth:error')
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
        ctx.emitter.emit('auth:disconnected')
      }

      client.session.delete()
      logger.verbose('Logged out from Telegram')
      return Ok(null)
    }

    return {
      loginWithPhone,
      loginWithSession,
      logout,
    }
  }
}
