import type { Config } from '@tg-search/common'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import type { StringSession } from 'telegram/sessions'
import type { CoreEmitter } from '../client'

import { getConfig, useLogger } from '@tg-search/common'
import { Api, TelegramClient } from 'telegram'

import { waitForEvent } from '../utils/promise'
import { withResult } from '../utils/result'

export interface ConnectionEvent {
  'auth:init': undefined
  'auth:login': {
    session: StringSession
  }
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
  'auth:connected': undefined
  'auth:progress': {
    progress: 'success' | 'failed'
    error?: Error
  }
}

export function createConnectionService(emitter: CoreEmitter) {
  const logger = useLogger()
  const config = getConfig()

  const apiId = Number(config.api.telegram.apiId)
  const apiHash = config.api.telegram.apiHash
  if (!apiId || !apiHash) {
    return withResult(null, new Error('API ID and API Hash are required'))
  }

  emitter.on('auth:login', async (session: StringSession) => {
    logger.debug('Logged in to Telegram')
    await login(session)
  })

  emitter.on('auth:logout', () => {
    logger.debug('Logged out from Telegram')
  })

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

  async function init(session: StringSession) {
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
  }

  async function login(session: StringSession) {
    try {
      const { data: client, error } = await init(session)
      if (!client || error) {
        logger.withError(error).error('Failed to initialize Telegram client')
        return withResult(null, error)
      }

      await client.connect()
      const isAuthorized = await client.isUserAuthorized()
      if (!isAuthorized) {
        client.signInUser({
          apiId,
          apiHash,
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

      emitter.emit('auth:connected')
      emitter.emit('auth:progress', {
        progress: 'success',
      })
      return withResult(null, null)
    }
    catch (error) {
      logger.withError(error).error('Failed to connect to Telegram')
      return withResult(null, error)
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
  }

  return {
    login,
    logout,
  }
}
