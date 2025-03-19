import type { CoreEmitter, CoreEvent } from '../client'

export function waitForEvent<E extends keyof CoreEvent>(
  coreEmitter: CoreEmitter,
  event: E,
): Promise<CoreEvent[E]> {
  return new Promise((resolve) => {
    coreEmitter.once(event, (...args: unknown[]) => {
      resolve(args as unknown as CoreEvent[E])
    })
  })
}
