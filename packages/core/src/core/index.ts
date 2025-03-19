import { getConfig } from '@tg-search/common'

import { useCoreClient } from './client'
import { useEventHandler } from './event-handler'

async function init() {
  const coreClient = useCoreClient()
  const config = getConfig()

  useEventHandler(coreClient, config)
}

init()
