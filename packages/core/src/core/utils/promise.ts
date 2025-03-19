import type EventEmitter from 'eventemitter3'

export function waitForEvent<T>(eventEmitter: EventEmitter, event: string): Promise<T> {
  return new Promise((resolve) => {
    eventEmitter.once(event, (event: T) => {
      resolve(event)
    })
  })
}
