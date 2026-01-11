import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'

import type { CoreContext } from '../context'
import type { MediaBinaryProvider } from '../types/storage'

import { useLogger } from '@guiiai/logg'

import { useService } from '../context'
import { useMessageResolverRegistry } from '../message-resolvers'
import { createAvatarResolver } from '../message-resolvers/avatar-resolver'
import { createEmbeddingResolver } from '../message-resolvers/embedding-resolver'
import { createJiebaResolver } from '../message-resolvers/jieba-resolver'
import { createLinkResolver } from '../message-resolvers/link-resolver'
import { createMediaResolver } from '../message-resolvers/media-resolver'
import { createUserResolver } from '../message-resolvers/user-resolver'
import { models } from '../models'
import { accountModels } from '../models/accounts'
import { chatMessageStatsModels } from '../models/chat-message-stats'
import { photoModels } from '../models/photos'
import { stickerModels } from '../models/stickers'
import { userModels } from '../models/users'
import { createAccountService } from '../services/account'
import { createAccountSettingsService } from '../services/account-settings'
import { createConnectionService } from '../services/connection'
import { createDialogService } from '../services/dialog'
import { createEntityService } from '../services/entity'
import { createGramEventsService } from '../services/gram-events'
import { createMessageService } from '../services/message'
import { createMessageResolverService } from '../services/message-resolver'
import { createSyncService } from '../services/sync'
import { createTakeoutService } from '../services/takeout'
import { registerAccountSettingsEventHandlers } from './account-settings'
import { registerAuthEventHandlers } from './auth'
import { fetchDialogs, registerDialogEventHandlers } from './dialog'
import { registerEntityEventHandlers } from './entity'
import { registerGramEventsEventHandlers } from './gram-events'
import { registerMessageEventHandlers } from './message'
import { registerMessageResolverEventHandlers } from './message-resolver'
import { registerStorageEventHandlers } from './storage'
import { registerTakeoutEventHandlers } from './takeout'

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

  const accountService = useService(ctx, logger, createAccountService)
  const entityService = useService(ctx, logger, createEntityService)
  const messageService = createMessageService(ctx, logger, entityService)
  const dialogService = useService(ctx, logger, createDialogService)
  const takeoutService = useService(ctx, logger, createTakeoutService)
  const syncService = useService(ctx, logger, createSyncService)
  const gramEventsService = useService(ctx, logger, createGramEventsService)

  ctx.emitter.once('auth:connected', async () => {
    // Register entity handlers first so we can establish currentAccountId.
    logger.verbose('Getting me info')
    const account = (await accountService.fetchMyAccount()).expect('Failed to get me info')

    // Record account and set current account ID
    logger.withFields({ userId: account.id }).verbose('Recording account for current user')

    // Record account in DB
    const dbAccount = await accountModels.recordAccount(ctx.getDB(), 'telegram', account.id)
    ctx.setCurrentAccountId(dbAccount.id)

    // Trigger sync catch-up in background after account is identified
    ctx.emitter.on('sync:catch-up', async () => {
      await syncService.catchUp()
    })
    ctx.emitter.on('sync:reset', async () => {
      await syncService.reset()
    })
    void syncService.catchUp()
    ctx.setMyUser(account)

    // Fetch dialogs
    await fetchDialogs(ctx, logger, models, dialogService)
    // Fetch contacts to ensure we have access hashes for all contacts
    await dialogService.fetchContacts()

    logger.withFields({ accountId: dbAccount.id }).verbose('Set current account ID')

    ctx.emitter.emit('account:ready', { accountId: dbAccount.id })
  })

  ctx.emitter.once('account:ready', ({ accountId }) => {
    logger = logger.withFields({ accountId })

    registerEntityEventHandlers(ctx, logger)(entityService)
    registerMessageEventHandlers(ctx, logger)(messageService)
    registerDialogEventHandlers(ctx, logger, models)(dialogService)
    registerTakeoutEventHandlers(ctx, logger, models.chatModels, chatMessageStatsModels)(takeoutService)
    registerGramEventsEventHandlers(ctx, logger, accountModels, models.chatModels)(gramEventsService)

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
