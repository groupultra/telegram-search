import type { CoreContext } from './context'

import { useConfig } from '@tg-search/common'

import { createCoreContext } from './context'
import { afterConnectedEventHandler, authEventHandler, useEventHandler } from './event-handler'

export interface ClientInstanceEventToCore {
  'core:cleanup': () => void
}

export interface ClientInstanceEventFromCore {
  'core:error': (data: { error?: string | Error | unknown }) => void
}

export type ClientInstanceEvent = ClientInstanceEventFromCore & ClientInstanceEventToCore

export function createCoreInstance(): CoreContext {
  const ctx = createCoreContext()
  const config = useConfig()

  const { register: registerEventHandler } = useEventHandler(ctx, config)
  registerEventHandler(authEventHandler)
  registerEventHandler(afterConnectedEventHandler)

  return ctx
}

export async function destoryCoreInstance(ctx: CoreContext) {
  // ctx.emitter.emit('auth:logout')
  ctx.emitter.emit('core:cleanup')
  ctx.emitter.removeAllListeners()
}
