import type { TelegramClient } from 'telegram'

import { createClient } from './client'
import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'
import { createConnectionService } from './services/connection'
import { createMessageService } from './services/messages'
import { createSessionService } from './services/session'
import { createTakeoutService } from './services/takeout'

async function init() {
  const emitter = createClient()
  const registry = useResolverRegistry()

  const { data: session } = await createSessionService(emitter).loadSession()
  createConnectionService(emitter)

  if (session) {
    emitter.emit('auth:login', { session })
  }

  emitter.on('auth:connected', (client: TelegramClient) => {
    createMessageService(emitter, client)
    createTakeoutService(emitter, client)

    registry.register('embedding', createEmbeddingResolver())
    registry.register('link', createLinkResolver())
    registry.register('user', createUserResolver())
  })
}

init()
