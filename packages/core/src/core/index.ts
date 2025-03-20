import { getConfig } from '@tg-search/common'

import { useCoreContext } from './client'
import { afterConnectedEventHandler, authEventHandler, useEventHandler } from './event-handler'
import { createSessionService } from './services/session'

export default async function init() {
  const ctx = useCoreContext()
  const config = getConfig()

  const { register: registerEventHandler } = useEventHandler(ctx, config)
  registerEventHandler(authEventHandler)
  registerEventHandler(afterConnectedEventHandler)

  const { data: session } = await createSessionService(ctx.emitter).loadSession()
  if (session) {
    ctx.emitter.emit('auth:login', { session })
  }
}
