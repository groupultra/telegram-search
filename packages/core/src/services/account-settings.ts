import type { Config } from '@tg-search/common'

import type { CoreContext } from '../context'

import { configSchema } from '@tg-search/common'
import { safeParse } from 'valibot'

export type AccountSettingsService = ReturnType<typeof createAccountSettingsService>

export function createAccountSettingsService(ctx: CoreContext) {
  // FIXME: deprecated
  async function fetchConfig() {
    // const config = ctx.getConfig()

    // ctx.emitter.emit('config:data', { config })
  }

  async function updateConfig(config: Config) {
    const validatedConfig = safeParse(configSchema, config)
    // TODO: handle error
    if (!validatedConfig.success) {
      throw new Error('Invalid config')
    }
    // FIXME
    // updateConfigCommon(validatedConfig.output)

    ctx.emitter.emit('config:data', { config: validatedConfig.output })
  }

  return {
    fetchConfig,
    updateConfig,
  }
}
