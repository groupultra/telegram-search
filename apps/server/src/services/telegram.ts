import type { ITelegramClientAdapter } from '@tg-search/core'

import { getConfig, useLogger } from '@tg-search/common'
import { createAdapter } from '@tg-search/core'

const logger = useLogger()
let client: ITelegramClientAdapter | undefined

/**
 * Get or create a singleton Telegram client instance
 * Ensures only one client connection is maintained throughout the application lifecycle
 */
export async function useTelegramClient(): Promise<ITelegramClientAdapter> {
  // Return existing client if already initialized
  if (client)
    return client

  // Create new client instance
  const config = getConfig()
  const telegramConfig = config.api.telegram

  // Validate required config
  if (!telegramConfig.apiId || !telegramConfig.apiHash || !telegramConfig.phoneNumber) {
    throw new Error('Missing required Telegram API configuration')
  }

  // 记录代理配置信息
  if (telegramConfig.proxy) {
    logger.debug('使用代理连接Telegram', {
      proxyIp: telegramConfig.proxy.ip,
      proxyPort: telegramConfig.proxy.port,
      proxyType: telegramConfig.proxy.MTProxy
        ? 'MTProxy'
        : `SOCKS${telegramConfig.proxy.socksType || 5}`,
    })
  }

  logger.debug('Creating Telegram client with config', {
    apiId: telegramConfig.apiId,
    phoneNumber: telegramConfig.phoneNumber,
    hasProxy: !!telegramConfig.proxy,
  })

  const adapter = await createAdapter({
    type: 'client',
    apiId: Number(telegramConfig.apiId),
    apiHash: telegramConfig.apiHash,
    phoneNumber: telegramConfig.phoneNumber,
    proxy: telegramConfig.proxy, // 传递代理配置
  })

  // Ensure adapter is a client adapter
  if (adapter.type !== 'client') {
    throw new Error('Invalid adapter type: expected client adapter')
  }

  client = adapter as ITelegramClientAdapter
  return client
}
