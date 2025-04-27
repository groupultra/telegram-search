import type { Config } from '@tg-search/common'
import type { CoreContext } from './context'

import { useLogger } from '@tg-search/common'

import { useService } from './context'
import { registerAuthEventHandlers } from './event-handlers/auth'
import { registerConfigEventHandlers } from './event-handlers/config'
import { registerDialogEventHandlers } from './event-handlers/dialog'
import { registerEntityEventHandlers } from './event-handlers/entity'
import { registerMessageEventHandlers } from './event-handlers/message'
import { registerSessionEventHandlers } from './event-handlers/session'
import { registerStorageEventHandlers } from './event-handlers/storage'
import { registerTakeoutEventHandlers } from './event-handlers/takeout'
import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'
import { createConfigService } from './services/config'
import { createConnectionService } from './services/connection'
import { createDialogService } from './services/dialog'
import { createEntityService } from './services/entity'
import { createMessageService } from './services/message'
import { createSessionService } from './services/session'
import { createTakeoutService } from './services/takeout'

type EventHandler<T = void> = (ctx: CoreContext, config: Config) => T

export function authEventHandler(
  ctx: CoreContext,
  config: Config,
): EventHandler {
  const sessionService = useService(ctx, createSessionService)
  const connectionService = useService(ctx, createConnectionService)({
    apiId: Number(config.api.telegram.apiId),
    apiHash: config.api.telegram.apiHash,
    proxy: config.api.telegram.proxy,
  })
  const configService = useService(ctx, createConfigService)

  registerAuthEventHandlers(ctx)(connectionService, sessionService)
  registerSessionEventHandlers(ctx)(sessionService)
  registerStorageEventHandlers(ctx)
  registerConfigEventHandlers(ctx)(configService)

  return () => {}
}

export function afterConnectedEventHandler(
  ctx: CoreContext,
  _config: Config,
): EventHandler {
  const { emitter } = ctx
  const registry = useResolverRegistry()

  emitter.on('auth:connected', () => {
    const messageService = useService(ctx, createMessageService)
    const dialogService = useService(ctx, createDialogService)
    const takeoutService = useService(ctx, createTakeoutService)
    const entityService = useService(ctx, createEntityService)

    registry.register('embedding', createEmbeddingResolver())
    registry.register('link', createLinkResolver())
    registry.register('user', createUserResolver())

    registerMessageEventHandlers(ctx)(messageService)
    registerDialogEventHandlers(ctx)(dialogService)
    registerTakeoutEventHandlers(ctx)(takeoutService)
    registerEntityEventHandlers(ctx)(entityService)

    // TODO: get dialogs from cache
    emitter.emit('dialog:fetch')
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
