import type { CoreConfig } from '@tg-search/common'
import type { CoreContext } from '../context'

import { coreConfigSchema, updateConfig, useConfig } from '@tg-search/common'
import { safeParse } from 'valibot'

export interface ConfigEventToCore {
  'config:fetch': () => void
  'config:update': (data: { config: CoreConfig }) => void
}

export interface ConfigEventFromCore {
  'config:data': (data: { config: CoreConfig }) => void
}

export type ConfigEvent = ConfigEventFromCore & ConfigEventToCore

export function createConfigService(ctx: CoreContext) {
  const { emitter } = ctx

  async function fetchConfig() {
    const config = useConfig()

    emitter.emit('config:data', { config })
  }

  async function saveConfig(config: CoreConfig) {
    const validatedConfig = safeParse(coreConfigSchema, config)
    // TODO: handle error
    if (!validatedConfig.success) {
      throw new Error('Invalid config')
    }

    updateConfig(validatedConfig.output)

    emitter.emit('config:data', { config: validatedConfig.output })
  }

  return {
    fetchConfig,
    saveConfig,
  }
}
