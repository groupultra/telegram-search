import type { Config } from '@tg-search/common'
import type { CoreContext } from './context'

import { useLogger } from '@tg-search/common'

import { useService } from './context'
import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'
import { createConnectionService } from './services/connection'
import { createDialogService } from './services/dialogs'
import { createEntityService } from './services/entity'
import { createMessageService } from './services/messages'
import { createSessionService } from './services/session'
import { createTakeoutService } from './services/takeout'

type EventHandler<T = void> = (ctx: CoreContext, config: Config) => T

export function authEventHandler(
  ctx: CoreContext,
  config: Config,
): EventHandler {
  const { emitter, withError } = ctx
  const logger = useLogger('core:event:auth')

  const { loadSession, cleanSession, saveSession } = useService(ctx, createSessionService)
  const { login, logout } = useService(ctx, createConnectionService)({
    apiId: Number(config.api.telegram.apiId),
    apiHash: config.api.telegram.apiHash,
    proxy: config.api.telegram.proxy,
  })

  emitter.on('auth:login', async ({ phoneNumber }) => {
    const { data: session, error: sessionError } = await loadSession(phoneNumber)
    if (sessionError) {
      return withError(sessionError, 'Failed to load session')
    }

    logger.withFields({ session }).debug('Loaded session')

    const { error: loginError } = await login({ phoneNumber, session })
    if (loginError) {
      return withError(loginError, 'Failed to login to Telegram')
    }
  })

  emitter.on('auth:logout', async () => {
    logger.debug('Logged out from Telegram')
    const client = ctx.getClient()
    if (client) {
      await logout(client)
    }
  })

  emitter.on('session:clean', async ({ phoneNumber }) => {
    logger.withFields({ phoneNumber }).debug('Cleaning session')
    await cleanSession(phoneNumber)
  })

  emitter.on('session:save', async ({ phoneNumber, session }) => {
    logger.withFields({ phoneNumber }).debug('Saving session')
    await saveSession(phoneNumber, session)
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
    const { fetchDialogs } = useService(ctx, createDialogService)
    useService(ctx, createTakeoutService)
    const { getMeInfo } = useService(ctx, createEntityService)

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

    emitter.on('dialog:fetch', async () => {
      logger.debug('Fetching dialogs')
      await fetchDialogs()
    })

    emitter.on('entity:getMe', async () => {
      await getMeInfo()
    })

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
