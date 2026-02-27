import type { Eventa } from '@moeru/eventa'

import type { CoreEventContext } from '../context'

export function waitForEvent<P>(
  eventContext: CoreEventContext,
  event: Eventa<P>,
): Promise<P> {
  return new Promise((resolve) => {
    eventContext.once(event, (envelope: Eventa<P>) => {
      resolve(envelope.body as P)
    })
  })
}
