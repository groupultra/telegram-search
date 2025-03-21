import type { App, H3Event } from 'h3'

import { getConfig, updateConfig, useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { createResponse } from '../utils/response'

const logger = useLogger()

// Config validation schema
const configSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number(),
    user: z.string(),
    password: z.string(),
    database: z.string(),
    url: z.string().optional(),
  }),
  message: z.object({
    export: z.object({
      batchSize: z.number(),
      concurrent: z.number(),
      retryTimes: z.number(),
      maxTakeoutRetries: z.number(),
    }),
    batch: z.object({
      size: z.number(),
    }),
  }),
  path: z.object({
    session: z.string(),
    media: z.string(),
  }),
  api: z.object({
    telegram: z.object({
      apiId: z.string(),
      apiHash: z.string(),
      phoneNumber: z.string(),
    }),
    embedding: z.object({
      provider: z.enum(['openai', 'ollama']),
      model: z.string(),
      apiKey: z.string().optional(),
      apiBase: z.string().optional(),
    }),
  }),
})

/**
 * Setup config routes
 */
export function setupConfigRoutes(app: App) {
  const router = createRouter()

  // Get current config
  router.get('/', defineEventHandler(() => {
    const config = getConfig()
    return createResponse(config)
  }))

  // Update config
  router.put('/', defineEventHandler(async (event: H3Event) => {
    try {
      const body = await readBody(event)
      const validatedBody = configSchema.parse(body)
      const updatedConfig = updateConfig(validatedBody)
      return createResponse(updatedConfig)
    }
    catch (err) {
      logger.withError(err).error('Failed to update config')
      throw err
    }
  }))

  // Mount routes
  app.use('/config', router.handler)
}
