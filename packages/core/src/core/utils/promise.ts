import type { CoreEmitter, CoreEvent } from '../client'

type EventData<T> = T extends (data: infer D) => void ? D : never

export function waitForEvent<E extends keyof CoreEvent>(
  emitter: CoreEmitter,
  event: E,
): Promise<EventData<CoreEvent[E]>> {
  return new Promise((resolve) => {
    emitter.once(event, (data) => {
      resolve(data)
    })
  })
}
