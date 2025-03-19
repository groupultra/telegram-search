import type { Config } from '@tg-search/common'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import type { StringSession } from 'telegram/sessions'
import type { CoreEmitter } from '../client'

import { getConfig, useLogger } from '@tg-search/common'
import { Api, TelegramClient } from 'telegram'

import { waitForEvent } from '../utils/promise'
import { withResult } from '../utils/result'

export interface ConnectionEvent {
  'auth:login': undefined
  'auth:logout': undefined

  'auth:phoneNumber': {
    phoneNumber: string
  }
  'auth:code': {
    code: string
  }
  'auth:password': {
    password: string
  }

  'auth:needPhoneNumber': undefined
  'auth:needCode': undefined
  'auth:needPassword': undefined
}

export function useConnectionService(
  coreEmitter: CoreEmitter,
  session: StringSession,
) {
  const logger = useLogger()
  const config = getConfig()

  const apiId = Number(config.api.telegram.apiId)
  const apiHash = config.api.telegram.apiHash
  if (!apiId || !apiHash) {
    return withResult(null, new Error('API ID and API Hash are required'))
  }

  type ProxyConfig = Config['api']['telegram']['proxy']
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

  return {
    init: async () => {
      const proxy = getProxyInterface(config.api.telegram.proxy)
      if (proxy) {
        logger.withFields({ proxy }).debug('Using proxy')
      }

      const client = new TelegramClient(
        session,
        apiId,
        apiHash,
        {
          connectionRetries: 3,
          useWSS: proxy ? false : undefined,
          proxy,
        },
      )

      return withResult(client, null)
    },

    login: async (client: TelegramClient) => {
      try {
        await client.connect()

        const isAuthorized = await client.isUserAuthorized()

        if (!isAuthorized) {
          client.signInUser({
            apiId,
            apiHash,
          }, {
            phoneNumber: async () => {
              coreEmitter.emit('auth:needPhoneNumber')
              const { phoneNumber } = await waitForEvent(coreEmitter, 'auth:phoneNumber')
              return phoneNumber
            },
            phoneCode: async () => {
              coreEmitter.emit('auth:needCode')
              const { code } = await waitForEvent(coreEmitter, 'auth:code')
              return code
            },
            password: async () => {
              coreEmitter.emit('auth:needPassword')
              const { password } = await waitForEvent(coreEmitter, 'auth:password')
              return password
            },
            onError: (err: Error) => {
              logger.withError(err).error('Failed to sign in to Telegram')
            },
          })
        }

        return withResult(null, null)
      }
      catch (error) {
        logger.withError(error).error('Failed to connect to Telegram')
        return withResult(null, error)
      }
    },

    logout: async (client: TelegramClient) => {
      if (client.connected) {
        await client.invoke(new Api.auth.LogOut())
        await client.disconnect()
      }

      client.session.delete()
      coreEmitter.emit('auth:logout')
      logger.debug('Logged out from Telegram')
    },
  }
}
