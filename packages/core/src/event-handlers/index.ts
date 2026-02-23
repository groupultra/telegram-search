import type { Config } from '@tg-search/common'

import type { CoreContext } from '../context'
import type { MediaBinaryProvider } from '../types/storage'

import { useLogger } from '@guiiai/logg'

import { useMessageResolverRegistry } from '../message-resolvers'
import { createAvatarResolver } from '../message-resolvers/avatar-resolver'
import { createEmbeddingResolver } from '../message-resolvers/embedding-resolver'
import { createJiebaResolver } from '../message-resolvers/jieba-resolver'
import { createLinkResolver } from '../message-resolvers/link-resolver'
import { createMediaResolver } from '../message-resolvers/media-resolver'
import { createPhotoEmbeddingResolver } from '../message-resolvers/photo-embedding-resolver'
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
import { CoreEventType } from '../types/events'
import { registerAccountSettingsEventHandlers } from './account-settings'
import { registerAuthEventHandlers } from './auth'
import { fetchDialogs, registerDialogEventHandlers } from './dialog'
import { registerEntityEventHandlers } from './entity'
import { registerGramEventsEventHandlers } from './gram-events'
import { registerMessageEventHandlers } from './message'
import { registerMessageResolverEventHandlers } from './message-resolver'
import { registerStorageEventHandlers } from './storage'
import { registerTakeoutEventHandlers } from './takeout'

export interface EventHandlerDependencies {
  models: typeof models
  accountModels: typeof accountModels
  chatMessageStatsModels: typeof chatMessageStatsModels
  photoModels: typeof photoModels
  stickerModels: typeof stickerModels
  userModels: typeof userModels
}

export const defaultEventHandlerDependencies: EventHandlerDependencies = {
  models,
  accountModels,
  chatMessageStatsModels,
  photoModels,
  stickerModels,
  userModels,
}

type EventCleanup = () => void | Promise<void>
export type EventHandler = (
  ctx: CoreContext,
  config: Config,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
  deps: EventHandlerDependencies,
) => EventCleanup | void

export function basicEventHandler(
  ctx: CoreContext,
  config: Config,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
  deps: EventHandlerDependencies = defaultEventHandlerDependencies,
): EventCleanup | void {
  const logger = useLogger()

  const registry = useMessageResolverRegistry(logger)

  const connectionService = createConnectionService(ctx, logger, {
    apiId: Number(config.api.telegram.apiId!),
    apiHash: config.api.telegram.apiHash!,
    proxy: config.api.telegram.proxy,
  })
  const configService = createAccountSettingsService(ctx, logger)
  const messageResolverService = createMessageResolverService(ctx, logger, registry)

  registry.register('media', createMediaResolver(ctx, logger, deps.photoModels, deps.stickerModels, mediaBinaryProvider))
  registry.register('user', createUserResolver(ctx, logger, deps.userModels))
  // Centralized avatar fetching for users (via messages)
  // Note: avatar resolver is registered but filtered by the disabled list
  // (see message-resolver service). Current strategy is client-driven and
  // on-demand via frontend events; the resolver remains available to enable
  // server-side prefetch in the future if desired.
  registry.register('avatar', createAvatarResolver(ctx, logger))
  registry.register('link', createLinkResolver(logger))
  // Photo embedding resolver: must run AFTER media resolver to ensure photos are downloaded
  registry.register('photo-embedding', createPhotoEmbeddingResolver(ctx, logger))
  registry.register('embedding', createEmbeddingResolver(ctx, logger))
  registry.register('jieba', createJiebaResolver(logger))

  registerStorageEventHandlers(ctx, logger, deps.models)
  registerAccountSettingsEventHandlers(ctx, logger)(configService)
  registerMessageResolverEventHandlers(ctx, logger)(messageResolverService)

  ;(async () => {
    registerAuthEventHandlers(ctx, logger)(connectionService)
  })()
}

export function afterConnectedEventHandler(
  ctx: CoreContext,
  _config: Config,
  _mediaBinaryProvider: MediaBinaryProvider | undefined,
  deps: EventHandlerDependencies = defaultEventHandlerDependencies,
): EventCleanup {
  let logger = useLogger()

  const accountService = createAccountService(ctx, logger)
  const entityService = createEntityService(ctx, logger)
  const messageService = createMessageService(ctx, logger, entityService)
  const dialogService = createDialogService(ctx, logger)
  const takeoutService = createTakeoutService(ctx, logger, deps.models.chatModels, deps.chatMessageStatsModels, entityService)
  const syncService = createSyncService(ctx, logger)
  const gramEventsService = createGramEventsService(ctx, logger)
  const syncCatchUpHandler = async () => {
    await syncService.catchUp()
  }
  const syncResetHandler = async () => {
    await syncService.reset()
  }

  ctx.emitter.once(CoreEventType.AuthConnected, async () => {
    // Register entity handlers first so we can establish currentAccountId.
    logger.verbose('Getting me info')
    const account = (await accountService.fetchMyAccount()).expect('Failed to get me info')

    // Record account and set current account ID
    logger.withFields({ userId: account.id }).verbose('Recording account for current user')

    // Record account in DB
    const dbAccount = await deps.accountModels.recordAccount(ctx.getDB(), 'telegram', account.id)
    ctx.setCurrentAccountId(dbAccount.id)

    // Trigger sync catch-up in background after account is identified
    ctx.emitter.on(CoreEventType.SyncCatchUp, syncCatchUpHandler)
    ctx.emitter.on(CoreEventType.SyncReset, syncResetHandler)
    void syncService.catchUp()
    ctx.setMyUser(account)

    // Fetch dialogs
    await fetchDialogs(ctx, logger, deps.models, dialogService)
    // Fetch contacts to ensure we have access hashes for all contacts
    await dialogService.fetchContacts()

    logger.withFields({ accountId: dbAccount.id }).verbose('Set current account ID')

    ctx.emitter.emit(CoreEventType.AccountReady, { accountId: dbAccount.id })
  })

  ctx.emitter.once(CoreEventType.AccountReady, ({ accountId }) => {
    logger = logger.withFields({ accountId })

    registerEntityEventHandlers(ctx, logger)(entityService)
    registerMessageEventHandlers(ctx, logger)(messageService)
    registerDialogEventHandlers(ctx, logger, deps.models)(dialogService)
    registerTakeoutEventHandlers(ctx, takeoutService)
    registerGramEventsEventHandlers(ctx, logger, deps.accountModels, deps.models.chatModels)(gramEventsService)

    // Dialog bootstrap is now triggered from account:setup handler once
    // currentAccountId has been established, to avoid races where dialog or
    // storage handlers read account context too early.
    gramEventsService.registerGramEvents()
  })

  return () => {
    ctx.emitter.off(CoreEventType.SyncCatchUp, syncCatchUpHandler)
    ctx.emitter.off(CoreEventType.SyncReset, syncResetHandler)
    gramEventsService.cleanup()
  }
}
