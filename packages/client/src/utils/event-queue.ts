import type { UiNotificationData, UiNotificationType } from '@tg-search/core'

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
export function enqueueEventHandler<T extends UiNotificationType>(
  eventHandlersQueue: ClientEventHandlerQueueMap,
  event: T,
  handler: (data: UiNotificationData<T>) => void,
  predicate?: (data: UiNotificationData<T>) => boolean,
) {
  const queue = eventHandlersQueue.get(event) ?? []
  queue.push({
    handler: handler as unknown as ClientEventHandler<UiNotificationType>,
    predicate: predicate as ((data: UiNotificationData<UiNotificationType>) => boolean) | undefined,
    createdAt: Date.now(),
  } satisfies ClientQueuedEventHandler<UiNotificationType>)
  eventHandlersQueue.set(event, queue)
}

/**
 * Drain and invoke all queued handlers for an event type in FIFO order.
 * Any error is delegated to the provided onError callback.
 */
export function drainEventQueue<T extends UiNotificationType>(
  eventHandlersQueue: ClientEventHandlerQueueMap,
  event: T,
  data: UiNotificationData<T>,
  onError: (error: unknown) => void,
) {
  const queue = eventHandlersQueue.get(event) as ClientQueuedEventHandler<UiNotificationType>[] | undefined
  if (!queue || queue.length === 0)
    return

  const now = Date.now()
  const remaining: ClientQueuedEventHandler<UiNotificationType>[] = []
  while (queue.length > 0) {
    const queued = queue.shift()
    if (!queued) {
      continue
    }

    // Drop stale handlers whose predicate never matched
    if (queued.createdAt && now - queued.createdAt > HANDLER_EXPIRY_MS) {
      continue
    }

    if (queued.predicate && !queued.predicate(data as UiNotificationData<UiNotificationType>)) {
      remaining.push(queued)
      continue
    }

    try {
      queued.handler(data as UiNotificationData<UiNotificationType>)
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
