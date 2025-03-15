import type { ClientProxyConfig } from '@tg-search/common'
import type { TelegramAdapter, TelegramAdapterType } from '../types'

import { BotAdapter } from './bot'
import { ClientAdapter } from './client'

export interface TelegramAdapterConfig {
  type: TelegramAdapterType
  // Bot token for bot adapter
  token?: string
  // Client credentials for client adapter
  apiId?: number
  apiHash?: string
  phoneNumber?: string
  password?: string
  proxy?: ClientProxyConfig
}

/**
 * Create a Telegram adapter
 */
export function createAdapter(config: TelegramAdapterConfig): TelegramAdapter {
  switch (config.type) {
    case 'bot':
      if (!config.token) {
        throw new Error('Bot token is required')
      }
      return new BotAdapter(config.token)
    case 'client':
      if (!config.apiId || !config.apiHash || !config.phoneNumber) {
        throw new Error('API credentials are required')
      }
      return new ClientAdapter({
        apiId: config.apiId,
        apiHash: config.apiHash,
        phoneNumber: config.phoneNumber,
        password: config.password,
        proxy: config.proxy,
      })
    default:
      throw new Error(`Unknown adapter type: ${config.type}`)
  }
}
