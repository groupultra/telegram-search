import { createClient } from './client'
import { useResolverRegistry } from './registry'

function init() {
  const _client = createClient()
  const _registry = useResolverRegistry()
}

init()
