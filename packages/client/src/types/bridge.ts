import type { SignInTicketResult, UiCommandInput, UiCommandType, UiNotificationData, UiNotificationType } from '@tg-search/core'
import type {
  AppResult,
  ChatRecord,
  CursorPage,
  ListChatsInput,
  ListRemoteMessagesInput,
  MessageContext,
  MessageContextInput,
  MessageRecord,
  QueryLocalMessagesInput,
  SearchMessageRecord,
  SearchMessagesInput,
  StatsInput,
  StatsResult,
} from '@tg-search/protocol'

export type ClientSendEventFn = <T extends UiCommandType>(event: T, data?: UiCommandInput<T>) => void

export interface BridgeAdapter {
  /**
   * Initialize the bridge adapter.
   */
  init: () => Promise<void>
  sendEvent: ClientSendEventFn
  waitForEvent: <T extends UiNotificationType>(
    event: T,
    predicate?: (data: UiNotificationData<T>) => boolean,
  ) => Promise<UiNotificationData<T>>
  /** Requests a sign-in ticket for the Telegram account this session is logged in to. */
  requestSignInTicket: () => Promise<SignInTicketResult>
  application: ApplicationBridge
}

export interface ApplicationBridge {
  listChats: (input: ListChatsInput) => Promise<AppResult<CursorPage<ChatRecord>>>
  listRemoteMessages: (input: ListRemoteMessagesInput) => Promise<AppResult<CursorPage<MessageRecord>>>
  queryLocalMessages: (input: QueryLocalMessagesInput) => Promise<AppResult<CursorPage<MessageRecord>>>
  searchLocalMessages: (input: SearchMessagesInput) => Promise<AppResult<CursorPage<SearchMessageRecord>>>
  getLocalMessageContext: (input: MessageContextInput) => Promise<AppResult<MessageContext>>
  getLocalStats: (input: StatsInput) => Promise<AppResult<StatsResult>>
  dispose?: () => void | Promise<void>
}
