import type { Config } from '@tg-search/common'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import type { StringSession } from 'telegram/sessions'
import type { CoreEmitter } from '../client'

import { getConfig, useLogger } from '@tg-search/common'
import { TelegramClient } from 'telegram'

import { waitForEvent } from '../utils/promise'
import { result } from '../utils/result'

export interface ConnectionEvent {
  'auth:code': {
    code: string
  }
  'auth:password': {
    password: string
  }

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
    return result(null, new Error('API ID and API Hash are required'))
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

      return result(client, null)
    },

    connect: async (client: TelegramClient) => {
      try {
        await client.connect()

        const isAuthorized = await client.isUserAuthorized()

        if (!isAuthorized) {
          client.signInUser({
            apiId,
            apiHash,
          }, {
            phoneNumber: config.api.telegram.phoneNumber,
            phoneCode: async () => {
              coreEmitter.emit('auth:code')
              return waitForEvent(coreEmitter, 'auth:code')
            },
            password: async () => {
              coreEmitter.emit('auth:password')
              return waitForEvent(coreEmitter, 'auth:password')
            },
            onError: (err: Error) => {
              logger.withError(err).error('Failed to sign in to Telegram')
            },
          })
        }

        return result(null, null)
      }
      catch (error) {
        logger.withError(error).error('Failed to connect to Telegram')
        return result(null, error)
      }
    },

  }
}
