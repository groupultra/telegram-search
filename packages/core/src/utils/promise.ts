import type { Eventa } from '@moeru/eventa'

import type { CoreEmitter } from '../context'

export function waitForEvent<P>(
  emitter: CoreEmitter,
  event: Eventa<P>,
): Promise<P> {
  return new Promise((resolve) => {
    emitter.once(event, (data) => {
      resolve(data)
    })
  })
}
