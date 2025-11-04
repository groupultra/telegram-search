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
  // ctx.emitter.emit('auth:logout')
  ctx.emitter.emit('core:cleanup')
  ctx.emitter.removeAllListeners()
}
