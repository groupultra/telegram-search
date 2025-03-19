import { createClient } from './client'
import { useResolverRegistry } from './registry'
import { createEmbeddingResolver } from './resolvers/embedding-resolver'
import { createLinkResolver } from './resolvers/link-resolver'
import { createUserResolver } from './resolvers/user-resolver'

function init() {
  const _client = createClient()
  const registry = useResolverRegistry()

  registry.register('embedding', createEmbeddingResolver())
  registry.register('link', createLinkResolver())
  registry.register('user', createUserResolver())
}

init()
