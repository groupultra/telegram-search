import type { Config, CorePagination } from '@tg-search/common'
import type { EventEmitter } from 'eventemitter3'
import type { Api } from 'telegram'

import type { CoreDialog } from './dialog'
import type { CoreMessage } from './message'
import type { CoreTask } from './task'

// ============================================================================
// Instance Events
// ============================================================================

export interface ClientInstanceEventToCore {
  'core:cleanup': () => void
}

export interface ClientInstanceEventFromCore {
  'core:error': (data: { error?: string | Error | unknown }) => void
}

// ============================================================================
// Connection Events (auth)
// ============================================================================

export interface ConnectionEventToCore {
  'auth:login': (data: { phoneNumber: string }) => void
  'auth:logout': () => void
  'auth:code': (data: { code: string }) => void
  'auth:password': (data: { password: string }) => void
}

export interface ConnectionEventFromCore {
  'auth:code:needed': () => void
  'auth:password:needed': () => void
  'auth:connected': () => void
  'auth:error': (data: { error: unknown }) => void
}

// ============================================================================
// Session Events
// ============================================================================

export interface SessionEventToCore {
  'session:update': (data: { phoneNumber: string, session: string }) => void
  'session:clean': (data: { phoneNumber: string }) => void
}

export interface SessionEventFromCore {}

// ============================================================================
// Config Events
// ============================================================================

export interface ConfigEventToCore {
  'config:fetch': () => void
  'config:update': (data: { config: Config }) => void
}

export interface ConfigEventFromCore {
  'config:data': (data: { config: Config }) => void
}

// ============================================================================
// Message Events
// ============================================================================

export interface MessageEventToCore {
  'message:fetch': (data: FetchMessageOpts) => void
  'message:fetch:abort': (data: { taskId: string }) => void
  'message:fetch:specific': (data: { chatId: string, messageIds: number[] }) => void
  'message:send': (data: { chatId: string, content: string }) => void
}

export interface MessageEventFromCore {
  'message:fetch:progress': (data: { taskId: string, progress: number }) => void
  'message:data': (data: { messages: CoreMessage[] }) => void
}

export interface FetchMessageOpts {
  chatId: string
  pagination: CorePagination

  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: string[]

  // Incremental export
  minId?: number
  maxId?: number
}

// ============================================================================
// Dialog Events
// ============================================================================

export interface DialogEventToCore {
  'dialog:fetch': () => void
}

export interface DialogEventFromCore {
  'dialog:data': (data: { dialogs: CoreDialog[] }) => void
}

// ============================================================================
// Entity Events
// ============================================================================

export interface EntityEventToCore {
  'entity:me:fetch': () => void
}

export interface EntityEventFromCore {
  'entity:me:data': (data: CoreUserEntity) => void
}

export interface CoreBaseEntity {
  id: string
  name: string
}

export interface CoreUserEntity extends CoreBaseEntity {
  type: 'user'
  username: string
}

export interface CoreChatEntity extends CoreBaseEntity {
  type: 'chat'
}

export interface CoreChannelEntity extends CoreBaseEntity {
  type: 'channel'
}

export type CoreEntity = CoreUserEntity | CoreChatEntity | CoreChannelEntity

// ============================================================================
// Storage Events
// ============================================================================

export interface StorageEventToCore {
  'storage:fetch:messages': (data: { chatId: string, pagination: CorePagination }) => void
  'storage:record:messages': (data: { messages: CoreMessage[] }) => void

  'storage:fetch:dialogs': () => void
  'storage:record:dialogs': (data: { dialogs: CoreDialog[] }) => void

  'storage:search:messages': (data: CoreMessageSearchParams) => void

  'storage:fetch:message-context': (data: StorageMessageContextParams) => void
}

export interface StorageEventFromCore {
  'storage:messages': (data: { messages: CoreMessage[] }) => void

  'storage:dialogs': (data: { dialogs: CoreDialog[] }) => void

  'storage:search:messages:data': (data: { messages: CoreRetrievalMessages[] }) => void

  'storage:messages:context': (data: { messages: CoreMessage[] } & StorageMessageContextParams) => void
}

export interface CoreMessageSearchParams {
  chatId?: string
  content: string

  useVector: boolean
  pagination?: CorePagination
}

export type CoreRetrievalMessages = CoreMessage & {
  similarity?: number
  timeRelevance?: number
  combinedScore?: number
}

export interface StorageMessageContextParams {
  chatId: string
  messageId: string
  before?: number
  after?: number
}

// ============================================================================
// Takeout Events
// ============================================================================

export interface TakeoutEventToCore {
  'takeout:run': (data: { chatIds: string[], increase?: boolean }) => void
  'takeout:task:abort': (data: { taskId: string }) => void
}

export interface TakeoutEventFromCore {
  'takeout:task:progress': (data: CoreTask<'takeout'>) => void
}

export interface TakeoutOpts {
  chatId: string
  pagination: CorePagination

  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: string[]

  // Incremental export
  minId?: number
  maxId?: number

  // Expected total count for progress calculation (optional, will fetch from Telegram if not provided)
  expectedCount?: number

  // Disable auto progress emission (for manual progress management in handler)
  disableAutoProgress?: boolean

  // Task object (required, should be created by handler and passed in)
  task: CoreTask<'takeout'>
}

// ============================================================================
// Gram Events (Telegram real-time events)
// ============================================================================

export interface GramEventsEventToCore {}

export interface GramEventsEventFromCore {
  'gram:message:received': (data: { message: Api.Message }) => void
}

// ============================================================================
// Message Resolver Events
// ============================================================================

export interface MessageResolverEventToCore {
  /**
   * Processes messages. If `isTakeout` is true, suppresses 'message:data' emissions (browser-facing)
   * while still recording messages to storage. Consumers should be aware that setting `isTakeout`
   * changes event side effects.
   */
  'message:process': (data: { messages: Api.Message[], isTakeout?: boolean }) => void
}

export interface MessageResolverEventFromCore {}

// ============================================================================
// Aggregated Event Types
// ============================================================================

export type FromCoreEvent = ClientInstanceEventFromCore
  & MessageEventFromCore
  & DialogEventFromCore
  & ConnectionEventFromCore
  & TakeoutEventFromCore
  & SessionEventFromCore
  & EntityEventFromCore
  & StorageEventFromCore
  & ConfigEventFromCore
  & GramEventsEventFromCore
  & MessageResolverEventFromCore

export type ToCoreEvent = ClientInstanceEventToCore
  & MessageEventToCore
  & DialogEventToCore
  & ConnectionEventToCore
  & TakeoutEventToCore
  & SessionEventToCore
  & EntityEventToCore
  & StorageEventToCore
  & ConfigEventToCore
  & GramEventsEventToCore
  & MessageResolverEventToCore

export type CoreEvent = FromCoreEvent & ToCoreEvent

export type CoreEventData<T> = T extends (data: infer D) => void ? D : never

export type CoreEmitter = EventEmitter<CoreEvent, any>
