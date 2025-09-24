import type { CorePagination } from '@tg-search/common'

import type { CoreMessage } from '../utils/message'
import type { CoreDialog } from './dialog'

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

export type StorageEvent = StorageEventFromCore & StorageEventToCore
