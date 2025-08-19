import type { Config } from '@tg-search/common'

import type { CoreContext } from '../context'

import { configSchema } from '@tg-search/common'
import { updateConfig as updateConfigToFile, useConfig } from '@tg-search/common/node'
import { safeParse } from 'valibot'

export interface ConfigEventToCore {
  'config:fetch': () => void
  'config:update': (data: { config: Config }) => void
}

export interface ConfigEventFromCore {
  'config:data': (data: { config: Config }) => void
}

export type ConfigEvent = ConfigEventFromCore & ConfigEventToCore

export type ConfigService = ReturnType<typeof createConfigService>

export function createConfigService(ctx: CoreContext) {
  const { emitter } = ctx

  async function fetchConfig() {
    const config = useConfig()

    emitter.emit('config:data', { config })
  }

  async function updateConfig(config: Config) {
    const validatedConfig = safeParse(configSchema, config)
    // TODO: handle error
    if (!validatedConfig.success) {
      throw new Error('Invalid config')
    }

    updateConfigToFile(validatedConfig.output)

    emitter.emit('config:data', { config: validatedConfig.output })
  }

  return {
    fetchConfig,
    updateConfig,
  }
}
