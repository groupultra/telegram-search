import type { CoreContext } from '../context'
import type { createConfigService } from '../services/config'

import { useLogger } from '@tg-search/common'

export function registerConfigEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:config:event')

  return (configService: ReturnType<typeof createConfigService>) => {
    emitter.on('config:fetch', async () => {
      logger.debug('Getting config')

      configService.fetchConfig()
    })

    emitter.on('config:update', async ({ config }) => {
      logger.debug('Saving config')

      configService.updateConfig(config)
    })
  }
}
