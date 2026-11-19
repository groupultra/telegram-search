import type { Eventa, EventContext } from '@moeru/eventa'
import type { UiCommandInput, UiCommandType, UiNotificationData, UiNotificationType } from '@tg-search/core'

import { uiCommandContracts, uiNotificationContracts } from '@tg-search/core'

export type UiNotificationDispatch = <T extends UiNotificationType>(type: T, data: UiNotificationData<T>) => void

/** Sends a UI command on the client's Eventa context. */
export function emitUiCommand<T extends UiCommandType>(context: EventContext<any, any>, type: T, data?: UiCommandInput<T>) {
  return context.emit(uiCommandContracts[type].eventa, data as UiCommandInput<T>)
}

/** Delivers every UI notification that arrives on `context` to `dispatch`. */
export function listenUiNotifications(context: EventContext<any, any>, dispatch: UiNotificationDispatch): () => void {
  const disposers = (Object.keys(uiNotificationContracts) as UiNotificationType[]).map(type =>
    // Widened: the loop covers every notification type at once.
    context.on(uiNotificationContracts[type] as Eventa<unknown>, ({ body }) => dispatch(type, body as UiNotificationData<typeof type>)),
  )
  return () => {
    for (const dispose of disposers)
      dispose()
  }
}
