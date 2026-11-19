import type { UiNotificationData, UiNotificationType } from '@tg-search/core'

export type ClientEventHandler<T extends UiNotificationType> = (data: UiNotificationData<T>) => void
export interface ClientQueuedEventHandler<T extends UiNotificationType> {
  handler: ClientEventHandler<T>
  predicate?: (data: UiNotificationData<T>) => boolean
  createdAt?: number
}
export type ClientRegisterEventHandler = <T extends UiNotificationType>(event: T, handler: ClientEventHandler<T>) => void
export type ClientEventHandlerMap = Map<UiNotificationType, ClientEventHandler<UiNotificationType>>
export type ClientEventHandlerQueueMap = Map<UiNotificationType, ClientQueuedEventHandler<UiNotificationType>[]>

/**
 * Notifications reach the client on its Eventa context, which listens to
 * every UI notification contract; registering only selects the handler.
 */
export function getRegisterEventHandler(eventHandlersMap: ClientEventHandlerMap) {
  const registerEventHandler: ClientRegisterEventHandler = (event, handler) => {
    eventHandlersMap.set(event, handler as ClientEventHandler<UiNotificationType>)
  }

  return registerEventHandler
}

export type ClientRegisterEventHandlerFn = ReturnType<typeof getRegisterEventHandler>
