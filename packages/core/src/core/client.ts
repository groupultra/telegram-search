import type { CoreContext } from './context'
import type { Events } from './event-handler'

import { getConfig } from '@tg-search/common'

import { createCoreContext } from './context'
import { afterConnectedEventHandler, authEventHandler, useEventHandler } from './event-handler'
import { createSessionService } from './services/session'

export interface ClientEvent extends Events {
  cleanup: () => void
}

export function createCoreClient(): CoreContext {
  const ctx = createCoreContext()
  const config = getConfig()

  const { register: registerEventHandler } = useEventHandler(ctx, config)
  registerEventHandler(authEventHandler)
  registerEventHandler(afterConnectedEventHandler)

  return ctx
}

export async function setupSession(ctx: CoreContext) {
  const { data: session } = await createSessionService(ctx.emitter).loadSession()
  if (session) {
    ctx.emitter.emit('auth:login', { session })
  }
}

export async function destoryCoreClient(ctx: CoreContext) {
  ctx.emitter.emit('auth:logout')
  ctx.emitter.emit('cleanup')
  ctx.emitter.removeAllListeners()
}
