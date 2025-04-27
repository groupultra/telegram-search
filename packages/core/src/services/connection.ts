import type { ProxyConfig } from '@tg-search/common'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import type { StringSession } from 'telegram/sessions'
import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { useLogger } from '@tg-search/common'
import { Api, TelegramClient } from 'telegram'

import { waitForEvent } from '../utils/promise'
import { withResult } from '../utils/result'

export interface CoreUserInfo {
  id: string
  firstName: string
  lastName: string
  username: string
  photoUrl?: string
}

export interface ConnectionEventToCore {
  'auth:login': (data: { phoneNumber: string }) => void
  'auth:logout': () => void
  'auth:code': (data: { code: string }) => void
  'auth:password': (data: { password: string }) => void
}

export interface ConnectionEventFromCore {
  'auth:needCode': () => void
  'auth:needPassword': () => void
  'auth:connected': (data: { client?: TelegramClient }) => void
}

export type ConnectionEvent = ConnectionEventFromCore & ConnectionEventToCore

export function createConnectionService(ctx: CoreContext) {
  const { emitter, withError } = ctx

  return function (options: {
    apiId: number
    apiHash: string
    proxy?: ProxyConfig
  }) {
    const logger = useLogger()

    const getProxyInterface = (proxyConfig: ProxyConfig | undefined): ProxyInterface | undefined => {
      if (!proxyConfig)
        return undefined

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

    async function init(initOptions: {
      session: StringSession
    }): PromiseResult<TelegramClient> {
      const { session } = initOptions

      const proxy = getProxyInterface(options.proxy)
      if (proxy) {
        logger.withFields({ proxy }).debug('Using proxy')
      }

      const client = new TelegramClient(
        session,
        options.apiId,
        options.apiHash,
        {
          connectionRetries: 3,
          useWSS: proxy ? false : undefined,
          proxy,
        },
      )

      return withResult(client, null)
    }

    async function login(loginOptions: {
      phoneNumber: string
      session: StringSession
    }): PromiseResult<TelegramClient | null> {
      const { phoneNumber, session } = loginOptions

      try {
        const { data: client, error } = await init({ session })
        if (!client || error) {
          return withResult(null, withError(error, 'Failed to initialize Telegram client'))
        }

        logger.debug('Connecting to Telegram')

        // Try to connect to Telegram by using the session
        const isConnected = await client.connect()
        if (!isConnected) {
          return withResult(null, withError(new Error('Failed to connect to Telegram')))
        }

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          logger.debug('User is not authorized, signing in')

          await client.signInUser({
            apiId: options.apiId,
            apiHash: options.apiHash,
          }, {
            phoneNumber,
            phoneCode: async () => {
              logger.debug('Waiting for code')
              emitter.emit('auth:needCode')
              const { code } = await waitForEvent(emitter, 'auth:code')
              return code
            },
            password: async () => {
              logger.debug('Waiting for password')
              emitter.emit('auth:needPassword')
              const { password } = await waitForEvent(emitter, 'auth:password')
              return password
            },
            onError: (err: Error) => {
              withError(err, 'Failed to sign in to Telegram')
            },
          })
        }

        // NOTE: The client will return string session, so convert it directly
        const sessionString = await client.session.save() as unknown as string
        logger.withFields({ sessionString }).debug('Saving session')

        emitter.emit('session:save', { phoneNumber, session: sessionString })

        ctx.setClient(client)

        emitter.emit('auth:connected', { client })

        // Emit me info
        emitter.emit('entity:getMe')

        return withResult(client, null)
      }
      catch (error) {
        return withResult(null, withError(error, 'Failed to connect to Telegram'))
      }
    }

    async function logout(client: TelegramClient) {
      if (client.connected) {
        await client.invoke(new Api.auth.LogOut())
        await client.disconnect()
      }

      client.session.delete()
      emitter.emit('auth:logout')
      logger.debug('Logged out from Telegram')
      return withResult(null, null)
    }

    return {
      login,
      logout,
    }
  }
}
