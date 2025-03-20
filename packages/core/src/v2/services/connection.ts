import type { Config } from '@tg-search/common'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { useLogger } from '@tg-search/common'
import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

import { waitForEvent } from '../utils/promise'
import { withResult } from '../utils/result'

export interface ConnectionEvent {
  'auth:init': () => void
  'auth:login': (data: { session: StringSession }) => void
  'auth:logout': () => void

  'auth:phoneNumber': (data: { phoneNumber: string }) => void
  'auth:code': (data: { code: string }) => void
  'auth:password': (data: { password: string }) => void

  'auth:needPhoneNumber': () => void
  'auth:needCode': () => void
  'auth:needPassword': () => void

  'auth:connected': (data: { client: TelegramClient }) => void
  'auth:progress': (data: { progress: 'success' | 'failed', error?: Error }) => void
}

type ProxyConfig = Config['api']['telegram']['proxy']

export function createConnectionService(ctx: CoreContext) {
  const { emitter, withError } = ctx

  return function (options: {
    apiId: number
    apiHash: string
    proxy?: ProxyConfig
  }) {
    const logger = useLogger()

    const getProxyInterface = (proxyConfig: ProxyConfig): ProxyInterface | undefined => {
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

        await client.connect()
        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          client.signInUser({
            apiId: options.apiId,
            apiHash: options.apiHash,
          }, {
            phoneNumber: async () => {
              emitter.emit('auth:needPhoneNumber')
              const { phoneNumber } = await waitForEvent(emitter, 'auth:phoneNumber')
              return phoneNumber
            },
            phoneCode: async () => {
              emitter.emit('auth:needCode')
              const { code } = await waitForEvent(emitter, 'auth:code')
              return code
            },
            password: async () => {
              emitter.emit('auth:needPassword')
              const { password } = await waitForEvent(emitter, 'auth:password')
              return password
            },
            onError: (err: Error) => {
              emitter.emit('auth:progress', {
                progress: 'failed',
                error: err,
              })
              logger.withError(err).error('Failed to sign in to Telegram')
            },
          })
        }

        emitter.emit('auth:connected', { client })
        emitter.emit('auth:progress', {
          progress: 'success',
        })
        return withResult(client, null)
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
