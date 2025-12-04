import type { WsEventToClient, WsEventToClientData } from '@tg-search/server/types'

import type { ClientEventHandler, ClientEventHandlerQueueMap } from '../event-handlers'

/**
 * Queue a one-shot event handler for a specific event type.
 * Handlers are stored in FIFO order and drained by `drainEventQueue`.
 */
export function enqueueEventHandler<T extends keyof WsEventToClient>(
  eventHandlersQueue: ClientEventHandlerQueueMap,
  event: T,
  handler: (data: WsEventToClientData<T>) => void,
) {
  const queue = eventHandlersQueue.get(event) ?? []
  queue.push(handler as unknown as ClientEventHandler<keyof WsEventToClient>)
  eventHandlersQueue.set(event, queue)
}

/**
 * Drain and invoke all queued handlers for an event type in FIFO order.
 * Any error is delegated to the provided onError callback.
 */
export function drainEventQueue<T extends keyof WsEventToClient>(
  eventHandlersQueue: ClientEventHandlerQueueMap,
  event: T,
  data: WsEventToClientData<T>,
  onError: (error: unknown) => void,
) {
  const queue = eventHandlersQueue.get(event) as ClientEventHandler<keyof WsEventToClient>[] | undefined
  if (!queue || queue.length === 0)
    return

  while (queue.length) {
    const fn = queue.shift()
    try {
      fn?.(data as WsEventToClientData<keyof WsEventToClient>)
    }
    catch (error) {
      onError(error)
    }
  }

  eventHandlersQueue.delete(event)
}
