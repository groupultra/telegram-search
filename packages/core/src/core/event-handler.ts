import type { Config } from '@tg-search/common'
import type { Api } from 'telegram'
import type { StringSession } from 'telegram/sessions'
import type { CoreContext } from './client'

import { useLogger } from '@tg-search/common'

import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'
import { createConnectionService } from './services/connection'
import { createMessageService } from './services/messages'
import { createTakeoutService } from './services/takeout'

export type Events = Record<string, (data: any) => any>
type EventHandler<T = void> = (ctx: CoreContext, config: Config) => T

export function authEventHandler(
  ctx: CoreContext,
  config: Config,
): EventHandler {
  const { emitter, useService } = ctx
  const logger = useLogger()

  const { login, logout } = useService(createConnectionService)({
    apiId: Number(config.api.telegram.apiId),
    apiHash: config.api.telegram.apiHash,
    proxy: config.api.telegram.proxy,
  })

  emitter.on('auth:login', async ({ session }: { session?: StringSession }) => {
    logger.withFields({ session }).debug('Logged in to Telegram')

    const { data, error } = await login(session)
    if (error) {
      logger.withError(error).error('Failed to login to Telegram')
      return
    }

    ctx.setClient(data)
  })

  emitter.on('auth:logout', async () => {
    logger.debug('Logged out from Telegram')
    if (ctx.client) {
      await logout(ctx.client)
    }
  })

  return () => {}
}

export function afterConnectedEventHandler(
  ctx: CoreContext,
  _config: Config,
): EventHandler {
  const { emitter, useService } = ctx
  const registry = useResolverRegistry()

  emitter.on('auth:connected', ({ client }) => {
    const { processMessage } = useService(createMessageService)(client)
    useService(createTakeoutService)(client)

    registry.register('embedding', createEmbeddingResolver())
    registry.register('link', createLinkResolver())
    registry.register('user', createUserResolver())

    emitter.on('message:process', ({ message }: { message: Api.Message }) => {
      processMessage(message)
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
