import type { ClientProxyConfig } from '@tg-search/common'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { getConfig, useLogger } from '@tg-search/common'
import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

import { waitForEvent } from '../utils/promise'
import { withResult } from '../utils/result'

export interface ConnectionEvent {
  'auth:login': () => void
  'auth:logout': () => void

  'auth:phoneNumber': (data: { phoneNumber: string }) => void
  'auth:code': (data: { code: string }) => void
  'auth:password': (data: { password: string }) => void

  'auth:needPhoneNumber': () => void
  'auth:needCode': () => void
  'auth:needPassword': () => void

  'auth:connected': (data: { client?: TelegramClient }) => void
}

export function createConnectionService(ctx: CoreContext) {
  const { emitter, withError } = ctx

  return function (options: {
    apiId: number
    apiHash: string
    proxy?: ClientProxyConfig
  }) {
    const logger = useLogger()

    const getProxyInterface = (proxyConfig: ClientProxyConfig | undefined): ProxyInterface | undefined => {
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

    async function init(session?: StringSession): PromiseResult<TelegramClient> {
      if (!session) {
        session = new StringSession()
      }

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

    async function login(session?: StringSession): PromiseResult<TelegramClient | null> {
      try {
        const { data: client, error } = await init(session)
        if (!client || error) {
          return withResult(null, withError(error, 'Failed to initialize Telegram client'))
        }

        logger.debug('Connecting to Telegram')

        // Try to connect to Telegram by using the session
        await client.connect()

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          await client.signInUser({
            apiId: options.apiId,
            apiHash: options.apiHash,
          }, {
            phoneNumber: getConfig().api.telegram.phoneNumber,
            // phoneNumber: async () => {
            //   logger.debug('Waiting for phone number')
            //   emitter.emit('auth:needPhoneNumber')
            //   const { phoneNumber } = await waitForEvent(emitter, 'auth:phoneNumber')
            //   return phoneNumber
            // },
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

          emitter.emit('auth:connected', { client })
          return withResult(client, null)
        }
        else {
          // TODO: save session
          emitter.emit('auth:connected', { client })
          return withResult(client, null)
        }
      }
      catch (error) {
        return withResult(null, withError(error, 'Failed to connect to Telegram'))
      }
    }

    async function logout(client: TelegramClient): PromiseResult<null> {
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
