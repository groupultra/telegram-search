import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'

import type { CoreContext } from './context'
import type { MediaBinaryProvider } from './types/storage'

import { useLogger } from '@guiiai/logg'

import { useService } from './context'
import { registerAccountEventHandlers } from './event-handlers/account'
import { registerAccountSettingsEventHandlers } from './event-handlers/account-settings'
import { registerAuthEventHandlers } from './event-handlers/auth'
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
import { models } from './models'
import { accountModels } from './models/accounts'
import { chatMessageStatsModels } from './models/chat-message-stats'
import { photoModels } from './models/photos'
import { stickerModels } from './models/stickers'
import { userModels } from './models/users'
import { createAccountService } from './services/account'
import { createAccountSettingsService } from './services/account-settings'
import { createConnectionService } from './services/connection'
import { createDialogService } from './services/dialog'
import { createEntityService } from './services/entity'
import { createGramEventsService } from './services/gram-events'
import { createMessageService } from './services/message'
import { createMessageResolverService } from './services/message-resolver'
import { createTakeoutService } from './services/takeout'

type EventHandler<T = void> = (ctx: CoreContext, config: Config, mediaBinaryProvider: MediaBinaryProvider | undefined) => T

export function basicEventHandler(ctx: CoreContext, config: Config, mediaBinaryProvider: MediaBinaryProvider | undefined): EventHandler {
  const logger = useLogger()

  const registry = useMessageResolverRegistry(logger)

  const connectionService = useService(ctx, logger, createConnectionService)({
    apiId: Number(config.api.telegram.apiId!),
    apiHash: config.api.telegram.apiHash!,
    proxy: config.api.telegram.proxy,
  })
  const configService = useService(ctx, logger, createAccountSettingsService)
  const messageResolverService = useService(ctx, logger, createMessageResolverService)(registry)

  registry.register('media', createMediaResolver(ctx, logger, photoModels, stickerModels, mediaBinaryProvider))
  registry.register('user', createUserResolver(ctx, logger, userModels))
  // Centralized avatar fetching for users (via messages)
  // Note: avatar resolver is registered but filtered by the disabled list
  // (see message-resolver service). Current strategy is client-driven and
  // on-demand via frontend events; the resolver remains available to enable
  // server-side prefetch in the future if desired.
  registry.register('avatar', createAvatarResolver(ctx, logger))
  registry.register('link', createLinkResolver(logger))
  registry.register('embedding', createEmbeddingResolver (ctx, logger))
  registry.register('jieba', createJiebaResolver(logger))

  registerStorageEventHandlers(ctx, logger, models)
  registerAccountSettingsEventHandlers(ctx, logger)(configService)
  registerMessageResolverEventHandlers(ctx, logger)(messageResolverService)

  ;(async () => {
    registerAuthEventHandlers(ctx, logger)(connectionService)
  })()

  return () => {}
}

export function afterConnectedEventHandler(ctx: CoreContext): EventHandler {
  let logger = useLogger()

  ctx.emitter.once('auth:connected', () => {
    // Register entity handlers first so we can establish currentAccountId.
    const accountService = useService(ctx, logger, createAccountService)
    registerAccountEventHandlers(ctx, logger, accountModels)(accountService)

    // Ensure current account ID is established before any dialog/storage access.
    ctx.emitter.emit('account:setup')
  })

  ctx.emitter.once('account:ready', ({ accountId }) => {
    logger = logger.withFields({ accountId })

    const entityService = useService(ctx, logger, createEntityService)
    const messageService = useService(ctx, logger, createMessageService)
    const dialogService = useService(ctx, logger, createDialogService)
    const takeoutService = useService(ctx, logger, createTakeoutService)
    const gramEventsService = useService(ctx, logger, createGramEventsService)

    registerEntityEventHandlers(ctx, logger)(entityService)
    registerMessageEventHandlers(ctx, logger)(messageService)
    registerDialogEventHandlers(ctx, logger)(dialogService)
    registerTakeoutEventHandlers(ctx, logger, chatMessageStatsModels)(takeoutService)
    registerGramEventsEventHandlers(ctx, logger)(gramEventsService)

    // Dialog bootstrap is now triggered from account:setup handler once
    // currentAccountId has been established, to avoid races where dialog or
    // storage handlers read account context too early.
    gramEventsService.registerGramEvents()
  })

  return () => {}
}

export function useEventHandler(
  ctx: CoreContext,
  config: Config,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
  logger: Logger,
) {
  logger = logger.withContext('core:event-handler')

  function register(fn: EventHandler) {
    logger.withFields({ fn: fn.name }).log('Register event handler')
    fn(ctx, config, mediaBinaryProvider)
  }

  return {
    register,
  }
}
