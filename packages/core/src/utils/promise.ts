import type { CoreEmitter, CoreEvent, ExtractData } from '../context'

export function waitForEvent<E extends keyof CoreEvent>(
  emitter: CoreEmitter,
  event: E,
): Promise<ExtractData<CoreEvent[E]>> {
  return new Promise((resolve) => {
    // emitter.once(event, (data) => {
    // resolve(data)

    emitter.once(event, (...args) => {
      resolve(args[0] as ExtractData<CoreEvent[E]>)
    })
  })
}
