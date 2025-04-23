import type { Config } from '@tg-search/common'
import type { CoreContext } from '../context'

import { updateConfig, useConfig } from '@tg-search/common'
import { z } from 'zod'

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
    storage: z.string(),
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

export interface ConfigEventToCore {
  'config:get': () => void
  'config:save': (data: { config: Config }) => void
}

export interface ConfigEventFromCore {
  'config:result': (data: { config: Config }) => void
}

export type ConfigEvent = ConfigEventFromCore & ConfigEventToCore

export function createConfigService(ctx: CoreContext) {
  const { emitter } = ctx

  async function getConfig() {
    const config = useConfig()

    emitter.emit('config:result', { config })
  }

  async function saveConfig(config: Config) {
    try {
      const validatedConfig = configSchema.parse(config)
      updateConfig(validatedConfig)
      emitter.emit('config:result', { config: validatedConfig })
    }
    catch (error) {
      emitter.emit('core:error', { error })
    }
  }

  return {
    getConfig,
    saveConfig,
  }
}
