import type { ProxyConfig } from '@tg-search/common'
import type { Result } from '@unbird/result'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'

import type { CoreContext } from '../context'

import { useLogger } from '@guiiai/logg'
import { isBrowser, updateConfig, useConfig } from '@tg-search/common'
import { Err, Ok } from '@unbird/result'
import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

import { waitForEvent } from '../utils/promise'

export type ConnectionService = ReturnType<ReturnType<typeof createConnectionService>>

export function createConnectionService(ctx: CoreContext) {
  const { emitter, withError } = ctx

  return function (options: {
    apiId: number
    apiHash: string
    proxy?: ProxyConfig
  }) {
    const logger = useLogger()

    const getProxyInterface = (proxyConfig: ProxyConfig | undefined): ProxyInterface | undefined => {
      // Check if we have a valid proxy configuration
      if (!proxyConfig || !proxyConfig.ip || !proxyConfig.port) {
        return undefined
      }

      if (proxyConfig.MTProxy && proxyConfig.secret) {
        // MTProxy configuration
        return {
          ip: proxyConfig.ip,
          port: proxyConfig.port,
          MTProxy: true,
          secret: proxyConfig.secret,
          timeout: proxyConfig.timeout || 15, // Default timeout of 15 seconds
        }
      }

      // SOCKS proxy configuration
      return {
        ip: proxyConfig.ip,
        port: proxyConfig.port,
        socksType: proxyConfig.socksType || 5, // Default to SOCKS5
        timeout: proxyConfig.timeout || 15, // Default timeout of 15 seconds
        username: proxyConfig.username,
        password: proxyConfig.password,
      }
    }

    async function init(session?: StringSession | string): Promise<Result<TelegramClient>> {
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
        },
      )

      return Ok(client)
    }

    async function loginWithSession(session: StringSession | string): Promise<Result<TelegramClient>> {
      try {
        const client = (await init(session)).expect('Failed to initialize Telegram client')
        const isConnected = await Promise.race<boolean>([
          client.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to Telegram')), 5000)),
        ])
        if (!isConnected) {
          return Err(withError('Failed to connect to Telegram'))
        }

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          const error = withError('User is not authorized')
          // Surface this as an auth-specific error so the frontend can fall
          // back to manual login and optionally clear the stored session.
          emitter.emit('auth:error', { error })
          emitter.emit('auth:disconnected')
          return Err(error)
        }

        // TODO: reactivity
        useConfig().api.telegram.autoReconnect = true
        updateConfig(useConfig())

        // NOTE: The client will return string session, so forward it to frontend
        const sessionString = await client.session.save() as unknown as string
        logger.withFields({ hasSession: !!sessionString }).verbose('Forwarding session to client')

        // 1) Forward updated session to frontend so it can persist it.
        emitter.emit('session:update', { session: sessionString })

        // 2) Attach client to context for subsequent services.
        ctx.setClient(client)

        // 3) Finally signal that auth is connected; this will trigger
        //    afterConnectedEventHandler, which will establish current
        //    account ID and bootstrap dialogs/storage.
        emitter.emit('auth:connected')

        logger.log('Login with session successful')

        return Ok(client)
      }
      catch (error) {
        emitter.emit('auth:error', { error })
        return Err(withError(error, 'Failed to connect to Telegram'))
      }
    }

    async function loginWithPhone(phoneNumber: string): Promise<Result<TelegramClient>> {
      try {
        const client = (await init()).expect('Failed to initialize Telegram client')

        logger.verbose('Connecting to Telegram')

        // Try to connect to Telegram by using the session
        const isConnected = await Promise.race<boolean>([
          client.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to Telegram')), 5000)),
        ])
        if (!isConnected) {
          return Err(withError('Failed to connect to Telegram'))
        }

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          await signIn(phoneNumber, client)
        }

        // TODO: reactivity
        useConfig().api.telegram.autoReconnect = true
        updateConfig(useConfig())

        // NOTE: The client will return string session, so forward it to frontend
        const sessionString = await client.session.save() as unknown as string
        logger.withFields({ hasSession: !!sessionString }).verbose('Forwarding session to client')

        // 1) Forward updated session
        emitter.emit('session:update', { session: sessionString })

        // 2) Attach client
        ctx.setClient(client)

        // 3) Notify connected; afterConnectedEventHandler will establish
        //    current account ID and bootstrap dialogs/storage.
        emitter.emit('auth:connected')

        logger.log('Login with phone successful')

        return Ok(client)
      }
      catch (error) {
        emitter.emit('auth:error', { error })
        return Err(withError(error, 'Failed to connect to Telegram'))
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
          // Set auto reconnect to false
          // TODO: reactivity
            useConfig().api.telegram.autoReconnect = false
            updateConfig(useConfig())

            logger.verbose('Waiting for code')
            emitter.emit('auth:code:needed')
            const { code } = await waitForEvent(emitter, 'auth:code')
            return code
          },
          password: async () => {
            logger.verbose('Waiting for password')
            emitter.emit('auth:password:needed')
            const { password } = await waitForEvent(emitter, 'auth:password')
            return password
          },
          onError: (error) => {
            emitter.emit('auth:error', { error })
            reject(withError(error, 'Failed to sign in to Telegram'))
          },
        })

        resolve(apiUser)
      })
    }

    async function logout(client: TelegramClient) {
      if (client.connected) {
        await client.invoke(new Api.auth.LogOut())
        await client.disconnect()
        emitter.emit('auth:disconnected')
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
