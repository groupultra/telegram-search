import type { Config } from '@tg-search/common'
import type { CoreContext } from './context'

import { useLogger } from '@tg-search/common'

import { useService } from './context'
import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'
import { createConnectionService } from './services/connection'
import { createMessageService } from './services/messages'
import { createTakeoutService } from './services/takeout'

type EventHandler<T = void> = (ctx: CoreContext, config: Config) => T

export function authEventHandler(
  ctx: CoreContext,
  config: Config,
): EventHandler {
  const { emitter } = ctx
  const logger = useLogger()

  const { login, logout } = useService(ctx, createConnectionService)({
    apiId: Number(config.api.telegram.apiId),
    apiHash: config.api.telegram.apiHash,
    proxy: config.api.telegram.proxy,
  })

  emitter.on('auth:login', async () => {
    const { data: client, error } = await login()
    if (error) {
      logger.withError(error).error('Failed to login to Telegram')
      return
    }

    if (client) {
      if (await client.isUserAuthorized()) {
        ctx.setClient(client)
      }
      else {
        logger.error('Client is not connected')
      }
    }
  })

  emitter.on('auth:logout', async () => {
    logger.debug('Logged out from Telegram')
    const client = ctx.getClient()
    if (client) {
      await logout(client)
    }
  })

  return () => {}
}

export function afterConnectedEventHandler(
  ctx: CoreContext,
  _config: Config,
): EventHandler {
  const logger = useLogger()

  const { emitter } = ctx
  const registry = useResolverRegistry()

  emitter.on('auth:connected', () => {
    const { processMessage, fetchMessages } = useService(ctx, createMessageService)
    useService(ctx, createTakeoutService)

    registry.register('embedding', createEmbeddingResolver())
    registry.register('link', createLinkResolver())
    registry.register('user', createUserResolver())

    emitter.on('message:process', ({ message }) => {
      processMessage(message)
    })

    emitter.on('message:fetch', async ({ chatId }) => {
      logger.withFields({ chatId }).debug('Fetching messages')

      try {
        await fetchMessages(chatId, { limit: 100 }).next()
      }
      catch (error) {
        emitter.emit('core:error', { error })
      }
    })
  })
  return () => {}
}

export function useEventHandler(
  ctx: CoreContext,
  config: Config,
) {
  const logger = useLogger()

  function register(fn: EventHandler) {
    logger.withFields({ fn: fn.name }).debug('Register event handler')
    fn(ctx, config)
  }

  return {
    register,
  }
}
