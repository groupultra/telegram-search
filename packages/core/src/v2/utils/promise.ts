import type { CoreEmitter, CoreEvent, CoreEventData } from '../context'

export function waitForEvent<E extends keyof CoreEvent>(
  emitter: CoreEmitter,
  event: E,
): Promise<CoreEventData<CoreEvent[E]>> {
  return new Promise((resolve) => {
    emitter.once(event, (data) => {
      resolve(data)
    })
  })
}
