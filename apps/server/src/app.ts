import type { NodeOptions } from 'crossws/adapters/node'

import { createServer } from 'node:http'
import { initConfig, initDB, initLogger, useLogger } from '@tg-search/common'
import { initCore } from '@tg-search/core'
import wsAdapter from 'crossws/adapters/node'
import { createApp, toNodeListener } from 'h3'

(async () => {
  initLogger()
  const logger = useLogger()
  initConfig()
  initDB()
  initCore()

  const port = 3000

  const app = createApp()

  const listener = toNodeListener(app)
  const server = createServer(listener).listen(port)
  const { handleUpgrade } = wsAdapter(app.websocket as NodeOptions)
  server.on('upgrade', handleUpgrade)
  logger.withFields({ port }).debug('Server started')
})().catch((error) => {
  console.error(error)
})
