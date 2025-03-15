import type { App, H3Event } from 'h3'
import type { SearchRequest } from '../types'

import { useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, readBody } from 'h3'

import { CommandManager } from '../services/commands/manager'
import { searchCommandSchema } from '../services/commands/search'
import { createSSEResponse } from '../utils/sse'

const logger = useLogger()

/**
 * Setup search routes
 */
export function setupSearchRoutes(app: App) {
  const router = createRouter()
  const commandManager = new CommandManager()

  // Search route
  router.post('/', defineEventHandler(async (event: H3Event) => {
    const body = await readBody<SearchRequest>(event)
    const validatedBody = searchCommandSchema.parse(body)

    logger.withFields(validatedBody).debug('Search request received')
    return createSSEResponse(async (controller) => {
      await commandManager.executeCommand('search', null, validatedBody, controller)
    })
  }))

  // Mount routes
  app.use('/search', router.handler)
}
