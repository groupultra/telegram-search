import type { Config } from '@tg-search/common'

import type { CoreContext } from './context'

import { useLogger } from '@tg-search/logg'

import { useService } from './context'
import { registerAuthEventHandlers } from './event-handlers/auth'
import { registerConfigEventHandlers } from './event-handlers/config'
import { registerDialogEventHandlers } from './event-handlers/dialog'
import { registerEntityEventHandlers } from './event-handlers/entity'
import { registerGramEventsEventHandlers } from './event-handlers/gram-events'
import { registerMessageEventHandlers } from './event-handlers/message'
import { registerSessionEventHandlers } from './event-handlers/session'
import { registerStorageEventHandlers } from './event-handlers/storage'
import { registerTakeoutEventHandlers } from './event-handlers/takeout'
import { useMessageResolverRegistry } from './message-resolvers'
import { createEmbeddingResolver } from './message-resolvers/embedding-resolver'
import { createJiebaResolver } from './message-resolvers/jieba-resolver'
import { createLinkResolver } from './message-resolvers/link-resolver'
import { createMediaResolver } from './message-resolvers/media-resolver'
import { createUserResolver } from './message-resolvers/user-resolver'
import { createConfigService } from './services/config'
import { createConnectionService } from './services/connection'
import { createDialogService } from './services/dialog'
import { createEntityService } from './services/entity'
import { createGramEventsService } from './services/gram-events'
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
  const registry = useMessageResolverRegistry()

  emitter.on('auth:connected', () => {
    const messageService = useService(ctx, createMessageService)(registry)
    const dialogService = useService(ctx, createDialogService)
    const takeoutService = useService(ctx, createTakeoutService)
    const entityService = useService(ctx, createEntityService)
    const gramEventsService = useService(ctx, createGramEventsService)

    registry.register('media', createMediaResolver(ctx))
    registry.register('user', createUserResolver(ctx))
    registry.register('link', createLinkResolver())
    registry.register('embedding', createEmbeddingResolver())
    registry.register('jieba', createJiebaResolver())

    registerMessageEventHandlers(ctx)(messageService)
    registerDialogEventHandlers(ctx)(dialogService)
    registerTakeoutEventHandlers(ctx)(takeoutService)
    registerEntityEventHandlers(ctx)(entityService)
    registerGramEventsEventHandlers(ctx)(gramEventsService)

    // Init all entities
    emitter.emit('dialog:fetch')
    gramEventsService.registerGramEvents()
  })

  return () => {}
}

export function useEventHandler(
  ctx: CoreContext,
  config: Config,
) {
  const logger = useLogger()

  function register(fn: EventHandler) {
    logger.withFields({ fn: fn.name }).log('Register event handler')
    fn(ctx, config)
  }

  return {
    register,
  }
}
