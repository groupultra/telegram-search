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
import type {
  WsEventToClient,
  WsEventToClientData,
  WsEventToServer,
  WsEventToServerData,
  WsMessageToServer,
} from '@tg-search/server/types'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export interface BridgeAdapter {
  /**
   * Initialize the bridge adapter.
   */
  init: () => Promise<void>
  sendEvent: ClientSendEventFn
  waitForEvent: <T extends keyof WsEventToClient>(
    event: T,
    predicate?: (data: WsEventToClientData<T>) => boolean,
  ) => Promise<WsEventToClientData<T>>
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
