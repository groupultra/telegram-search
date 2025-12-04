import type { Config } from '@tg-search/common'

import type { CoreContext } from './context'

import { useLogger } from '@guiiai/logg'

import { useService } from './context'
import { registerAccountSettingsEventHandlers } from './event-handlers/account-settings'
import { registerBasicEventHandlers } from './event-handlers/auth'
import { registerDialogEventHandlers } from './event-handlers/dialog'
import { registerEntityEventHandlers } from './event-handlers/entity'
import { registerGramEventsEventHandlers } from './event-handlers/gram-events'
import { registerMessageEventHandlers } from './event-handlers/message'
import { registerMessageResolverEventHandlers } from './event-handlers/message-resolver'
import { registerStorageEventHandlers } from './event-handlers/storage'
import { registerTakeoutEventHandlers } from './event-handlers/takeout'
import { useMessageResolverRegistry } from './message-resolvers'
import { createAvatarResolver } from './message-resolvers/avatar-resolver'
import { createEmbeddingResolver } from './message-resolvers/embedding-resolver'
import { createJiebaResolver } from './message-resolvers/jieba-resolver'
import { createLinkResolver } from './message-resolvers/link-resolver'
import { createMediaResolver } from './message-resolvers/media-resolver'
import { createUserResolver } from './message-resolvers/user-resolver'
import { createAccountSettingsService } from './services/account-settings'
import { createConnectionService } from './services/connection'
import { createDialogService } from './services/dialog'
import { createEntityService } from './services/entity'
import { createGramEventsService } from './services/gram-events'
import { createMessageService } from './services/message'
import { createMessageResolverService } from './services/message-resolver'
import { createTakeoutService } from './services/takeout'

type EventHandler<T = void> = (ctx: CoreContext, config: Config) => T

export function basicEventHandler(ctx: CoreContext, config: Config): EventHandler {
  const registry = useMessageResolverRegistry()

  const connectionService = useService(ctx, createConnectionService)({
    apiId: Number(config.api.telegram.apiId!),
    apiHash: config.api.telegram.apiHash!,
    proxy: config.api.telegram.proxy,
  })
  const configService = useService(ctx, createAccountSettingsService)
  const messageResolverService = useService(ctx, createMessageResolverService)(registry)

  registry.register('media', createMediaResolver(ctx))
  registry.register('user', createUserResolver(ctx))
  // Centralized avatar fetching for users (via messages)
  // Note: avatar resolver is registered but filtered by the disabled list
  // (see message-resolver service). Current strategy is client-driven and
  // on-demand via frontend events; the resolver remains available to enable
  // server-side prefetch in the future if desired.
  registry.register('avatar', createAvatarResolver(ctx))
  registry.register('link', createLinkResolver())
  registry.register('embedding', createEmbeddingResolver(ctx))
  registry.register('jieba', createJiebaResolver())

  registerStorageEventHandlers(ctx)
  registerAccountSettingsEventHandlers(ctx)(configService)
  registerMessageResolverEventHandlers(ctx)(messageResolverService)

  ;(async () => {
    registerBasicEventHandlers(ctx)(connectionService)
  })()

  return () => {}
}

export function afterConnectedEventHandler(ctx: CoreContext): EventHandler {
  ctx.emitter.once('auth:connected', () => {
    const entityService = useService(ctx, createEntityService)
    const messageService = useService(ctx, createMessageService)
    const dialogService = useService(ctx, createDialogService)
    const takeoutService = useService(ctx, createTakeoutService)
    const gramEventsService = useService(ctx, createGramEventsService)

    // Register entity handlers first so we can establish currentAccountId.
    registerEntityEventHandlers(ctx)(entityService)

    // Ensure current account ID is established before any dialog/storage access.
    ctx.emitter.emit('entity:me:fetch')

    registerMessageEventHandlers(ctx)(messageService)
    registerDialogEventHandlers(ctx)(dialogService)
    registerTakeoutEventHandlers(ctx)(takeoutService)
    registerGramEventsEventHandlers(ctx)(gramEventsService)

    // Dialog bootstrap is now triggered from entity:me:fetch handler once
    // currentAccountId has been established, to avoid races where dialog or
    // storage handlers read account context too early.
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
