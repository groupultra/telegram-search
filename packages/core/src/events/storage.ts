import type { CorePagination } from '@tg-search/common'

import type { CoreChatFolder, CoreDialog } from '../types/dialog'
import type { CoreMessageSearchParams, CorePhotoSearchParams, CoreRetrievalMessages, CoreRetrievalPhoto, StorageMessageContextParams } from '../types/events'
import type { CoreMessage } from '../types/message'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

// ============================================================================
// Storage RPC (client-facing)
// ============================================================================

/** Fetch messages from DB (RPC) */
export const storageFetchMessagesInvoke = defineInvokeEventa<
  { messages: CoreMessage[] },
  { chatId: string, pagination: CorePagination }
>('storage:fetch:messages')

/** Fetch dialogs from DB (RPC) */
export const storageFetchDialogsInvoke = defineInvokeEventa<
  { dialogs: CoreDialog[] },
  { accountId: string }
>('storage:fetch:dialogs')

/** Search messages (RPC) */
export const storageSearchMessagesInvoke = defineInvokeEventa<
  { messages: CoreRetrievalMessages[] },
  CoreMessageSearchParams
>('storage:search:messages')

/** Search photos (RPC) */
export const storageSearchPhotosInvoke = defineInvokeEventa<
  { photos: CoreRetrievalPhoto[] },
  CorePhotoSearchParams
>('storage:search:photos')

/** Fetch message context — surrounding messages (RPC) */
export const storageFetchMessageContextInvoke = defineInvokeEventa<
  { messages: CoreMessage[] } & StorageMessageContextParams,
  StorageMessageContextParams
>('storage:fetch:message-context')

/** Get or modify a chat note (RPC) */
export const storageChatNoteInvoke = defineInvokeEventa<
  { chatId: string, note: string },
  { chatId: string, note: string, modify: boolean }
>('storage:chat-note')

// ============================================================================
// Storage commands (internal, fire-and-forget)
// ============================================================================

/** Record messages to DB */
export const storageRecordMessagesEvent = defineEventa<{ messages: CoreMessage[] }>('storage:record:messages')

/** Record dialogs to DB */
export const storageRecordDialogsEvent = defineEventa<{ dialogs: CoreDialog[], accountId: string }>('storage:record:dialogs')

/** Record chat folders to DB */
export const storageRecordChatFoldersEvent = defineEventa<{ folders: CoreChatFolder[], accountId: string }>('storage:record:chat-folders')
