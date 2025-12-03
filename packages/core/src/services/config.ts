import type { Config } from '@tg-search/common'

import type { CoreContext } from '../context'

import { configSchema } from '@tg-search/common'
import { safeParse } from 'valibot'

export type ConfigService = ReturnType<typeof createConfigService>

export function createConfigService(ctx: CoreContext) {
  const { emitter, getConfig } = ctx

  async function fetchConfig() {
    const config = getConfig()

    emitter.emit('config:data', { config })
  }

  async function updateConfig(config: Config) {
    const validatedConfig = safeParse(configSchema, config)
    // TODO: handle error
    if (!validatedConfig.success) {
      throw new Error('Invalid config')
    }
    // FIXME
    // updateConfigCommon(validatedConfig.output)

    emitter.emit('config:data', { config: validatedConfig.output })
  }

  return {
    fetchConfig,
    updateConfig,
  }
}
