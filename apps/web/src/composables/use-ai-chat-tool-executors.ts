import type { CoreDialog, CoreRetrievalPhoto } from '@tg-search/core/types'
import type { Ref } from 'vue'

import type {
  ChatNoteParams,
  GetDialogsParams,
  RetrieveContextParams,
  SearchMessagesParams,
  SearchPhotosParams,
} from './useAIChat'

import { useLogger } from '@guiiai/logg'
import { useBridge, waitForEventWithTimeout } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'

function createRequestId() {
  return `ai-chat:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

interface UseAIChatToolExecutorsOptions {
  selectedChatIds: Ref<number[]>
}

export function useAIChatToolExecutors({ selectedChatIds }: UseAIChatToolExecutorsOptions) {
  const bridge = useBridge()
  const logger = useLogger('composables:ai-chat')

  async function searchMessages(params: SearchMessagesParams) {
    const requestId = createRequestId()

    bridge.sendEvent(CoreEventType.StorageSearchMessages, {
      requestId,
      content: params.query,
      useVector: params.useVector,
      pagination: {
        limit: params.limit,
        offset: 0,
      },
      fromUserId: params.fromUserId ?? undefined,
      timeRange: params.timeRange
        ? {
            start: params.timeRange.start ?? undefined,
            end: params.timeRange.end ?? undefined,
          }
        : undefined,
      chatIds: selectedChatIds.value.length > 0
        ? selectedChatIds.value.map(id => id.toString())
        : undefined,
    })

    const { messages } = await waitForEventWithTimeout(bridge.waitForEvent(
      CoreEventType.StorageSearchMessagesData,
      data => data.requestId === requestId,
    ))

    return messages
  }

  async function retrieveContext(params: RetrieveContextParams) {
    const requestId = createRequestId()

    bridge.sendEvent(CoreEventType.StorageSearchMessages, {
      requestId,
      chatId: params.chatId,
      content: '',
      useVector: false,
      pagination: {
        limit: params.limit,
        offset: 0,
      },
      timeRange: {
        end: params.targetTimestamp - 1,
      },
    })

    const { messages } = await waitForEventWithTimeout(bridge.waitForEvent(
      CoreEventType.StorageSearchMessagesData,
      data => data.requestId === requestId,
    ))

    return messages
  }

  async function getDialogs(_: GetDialogsParams) {
    bridge.sendEvent(CoreEventType.StorageFetchDialogs)
    const { dialogs } = await waitForEventWithTimeout(bridge.waitForEvent(CoreEventType.StorageDialogs))
    return dialogs as CoreDialog[]
  }

  async function searchPhotos(params: SearchPhotosParams) {
    logger.withFields({ params }).log('searchPhotos executor called')

    const requestId = createRequestId()

    bridge.sendEvent(CoreEventType.StorageSearchPhotos, {
      requestId,
      content: params.query,
      useVector: params.useVector,
      pagination: {
        limit: params.limit,
        offset: 0,
      },
      chatIds: selectedChatIds.value.length > 0
        ? selectedChatIds.value.map(id => id.toString())
        : undefined,
    })

    const { photos } = await waitForEventWithTimeout(bridge.waitForEvent(
      CoreEventType.StorageSearchPhotosData,
      data => data.requestId === requestId,
    ))

    logger.withFields({ photosCount: photos.length }).log('searchPhotos received response')
    return photos as CoreRetrievalPhoto[]
  }

  async function chatNote(params: ChatNoteParams) {
    bridge.sendEvent(CoreEventType.StorageChatNote, params)
    const { note } = await waitForEventWithTimeout(bridge.waitForEvent(CoreEventType.StorageChatNoteData))
    return note ?? ''
  }

  return {
    chatNote,
    getDialogs,
    retrieveContext,
    searchMessages,
    searchPhotos,
  }
}
