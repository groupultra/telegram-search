import type { WsEventToClient, WsEventToClientData } from '@tg-search/server/types'

import type { ClientEventHandler, ClientEventHandlerQueueMap, ClientQueuedEventHandler } from '../event-handlers'

const HANDLER_EXPIRY_MS = 30_000

/**
 * Race a `waitForEvent` promise against a timeout so callers never hang
 * indefinitely when the server fails to respond.
 */
export function waitForEventWithTimeout<T>(
  waitFn: Promise<T>,
  timeout = 10_000,
): Promise<T> {
  return Promise.race([
    waitFn,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('waitForEvent timeout')), timeout),
    ),
  ])
}

/**
 * Queue a one-shot event handler for a specific event type.
 * Handlers are stored in FIFO order and drained by `drainEventQueue`.
 */
export function enqueueEventHandler<T extends keyof WsEventToClient>(
  eventHandlersQueue: ClientEventHandlerQueueMap,
  event: T,
  handler: (data: WsEventToClientData<T>) => void,
  predicate?: (data: WsEventToClientData<T>) => boolean,
) {
  const queue = eventHandlersQueue.get(event) ?? []
  queue.push({
    handler: handler as unknown as ClientEventHandler<keyof WsEventToClient>,
    predicate: predicate as ((data: WsEventToClientData<keyof WsEventToClient>) => boolean) | undefined,
    createdAt: Date.now(),
  } satisfies ClientQueuedEventHandler<keyof WsEventToClient>)
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
  const queue = eventHandlersQueue.get(event) as ClientQueuedEventHandler<keyof WsEventToClient>[] | undefined
  if (!queue || queue.length === 0)
    return

  const now = Date.now()
  const remaining: ClientQueuedEventHandler<keyof WsEventToClient>[] = []
  while (queue.length > 0) {
    const queued = queue.shift()
    if (!queued) {
      continue
    }

    // Drop stale handlers whose predicate never matched
    if (queued.createdAt && now - queued.createdAt > HANDLER_EXPIRY_MS) {
      continue
    }

    if (queued.predicate && !queued.predicate(data as WsEventToClientData<keyof WsEventToClient>)) {
      remaining.push(queued)
      continue
    }

    try {
      queued.handler(data as WsEventToClientData<keyof WsEventToClient>)
    }
    catch (error) {
      onError(error)
    }
  }

  if (remaining.length > 0) {
    eventHandlersQueue.set(event, remaining)
    return
  }

  eventHandlersQueue.delete(event)
}
