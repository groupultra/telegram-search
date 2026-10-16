import type { CoreContext } from '@tg-search/core'

import type { createDaemonDiagnostics } from './diagnostics'

import { CoreEventType } from '@tg-search/core'

/** Authorization observations are independent from connection and login failures. */
export function registerDaemonAuthorizationHandlers(context: Pick<CoreContext, 'emitter'>, options: {
  isActiveContext: () => boolean
  diagnostics: Pick<ReturnType<typeof createDaemonDiagnostics>, 'authorization' | 'transport'>
  onState: (state: 'unauthorized' | 'error', error?: string) => void
}) {
  context.emitter.on(CoreEventType.AuthDisconnected, () => {
    if (!options.isActiveContext())
      return
    options.diagnostics.authorization('unauthorized')
    options.diagnostics.transport('disconnected')
    options.onState('unauthorized')
  })
  context.emitter.on(CoreEventType.AuthError, () => {
    if (!options.isActiveContext())
      return
    // ConnectionService also emits AuthError for network and initialization
    // failures; it is not evidence that the saved session was rejected.
    options.diagnostics.authorization('unknown')
    options.onState('error', 'Telegram session initialization failed')
  })
}
