import type { Config } from '@tg-search/common'
import type { Api, TelegramClient } from 'telegram'
import type { StringSession } from 'telegram/sessions'
import type { useCoreClient } from './client'

import { useLogger } from '@tg-search/common'

import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'
import { createConnectionService } from './services/connection'
import { createMessageService } from './services/messages'
import { createSessionService } from './services/session'
import { createTakeoutService } from './services/takeout'

export async function useEventHandler(
  coreClient: ReturnType<typeof useCoreClient>,
  config: Config,
) {
  const { emitter, useService } = coreClient
  const registry = useResolverRegistry()
  const logger = useLogger()

  let client: TelegramClient | null = null

  const { data: session } = await createSessionService(emitter).loadSession()
  const { login, logout } = useService(createConnectionService)({
    apiId: Number(config.api.telegram.apiId),
    apiHash: config.api.telegram.apiHash,
    proxy: config.api.telegram.proxy,
  })
  if (session) {
    emitter.emit('auth:login', { session })
  }

  emitter.on('auth:login', async (session: StringSession) => {
    logger.debug('Logged in to Telegram')
    const result = await login(session)
    client = result.data
  })

  emitter.on('auth:logout', async () => {
    logger.debug('Logged out from Telegram')
    if (client) {
      await logout(client)
    }
  })

  emitter.on('auth:connected', (client: TelegramClient) => {
    const { processMessage } = useService(createMessageService)(client)
    useService(createTakeoutService)(client)

    registry.register('embedding', createEmbeddingResolver())
    registry.register('link', createLinkResolver())
    registry.register('user', createUserResolver())

    emitter.on('message:process', (message: Api.Message) => {
      processMessage(message)
    })
  })
}
