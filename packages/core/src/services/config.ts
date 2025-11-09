import type { Config } from '@tg-search/common'

import type { CoreContext } from '../context'

import { configSchema, updateConfig as updateConfigCommon, useConfig } from '@tg-search/common'
import { safeParse } from 'valibot'

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
    updateConfigCommon(validatedConfig.output)

    emitter.emit('config:data', { config: validatedConfig.output })
  }

  return {
    fetchConfig,
    updateConfig,
  }
}
