import type { TelegramClient } from 'telegram'

import { useCoreClient } from './client'
import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'
import { createConnectionService } from './services/connection'
import { createMessageService } from './services/messages'
import { createSessionService } from './services/session'
import { createTakeoutService } from './services/takeout'

async function init() {
  const { emitter, useService } = useCoreClient()
  const registry = useResolverRegistry()

  const { data: session } = await createSessionService(emitter).loadSession()
  useService(createConnectionService)

  if (session) {
    emitter.emit('auth:login', { session })
  }

  emitter.on('auth:connected', (client: TelegramClient) => {
    useService(createMessageService)(client)
    useService(createTakeoutService)(client)

    registry.register('embedding', createEmbeddingResolver())
    registry.register('link', createLinkResolver())
    registry.register('user', createUserResolver())
  })
}

init()
