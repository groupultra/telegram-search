import type { Config } from '@tg-search/common'

import type { CoreContext } from './context'

import { createCoreContext } from './context'
import { afterConnectedEventHandler, basicEventHandler, useEventHandler } from './event-handler'

export function createCoreInstance(config: Config): CoreContext {
  const ctx = createCoreContext()

  const { register: registerEventHandler } = useEventHandler(ctx, config)
  registerEventHandler(basicEventHandler)
  registerEventHandler(afterConnectedEventHandler)

  return ctx
}

export async function destroyCoreInstance(ctx: CoreContext) {
  // Emit cleanup event to notify all services
  ctx.emitter.emit('core:cleanup')

  // Give services time to cleanup
  await new Promise(resolve => setTimeout(resolve, 100))

  // Disconnect Telegram client if connected
  try {
    const client = ctx.getClient()
    if (client && client.connected) {
      await client.disconnect()
    }
  }
  catch {
    // Client may not be set or already disconnected, ignore
  }

  // Use the cleanup method from CoreContext
  ctx.cleanup()
}
