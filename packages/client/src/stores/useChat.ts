import type { CoreChatFolder, CoreDialog, CoreMessage } from '@tg-search/core'

import type { VersionedScopedStorage } from '../utils/versioned-local-cache'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'

import { useBridge } from '../composables/useBridge'
import { readVersionedScopedCache, writeVersionedScopedCache } from '../utils/versioned-local-cache'
import { useSessionStore } from './useSession'

export const useChatStore = defineStore('chat', () => {
  const CHAT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
  const CHAT_CACHE_VERSION = 1
  const MAX_CACHED_CHAT_SCOPES = 8
  const sessionStore = useSessionStore()
  const bridge = useBridge()
  const allChats = useLocalStorage<VersionedScopedStorage<CoreDialog[]>>('v3/chat/chats', {})
  const allFolders = useLocalStorage<VersionedScopedStorage<CoreChatFolder[]>>('v3/chat/folders', {})
  const allPinnedOrders = useLocalStorage<VersionedScopedStorage<number[]>>('v3/chat/pinned-order', {})
  const logger = useLogger('ChatStore')

  const cacheOptions = {
    maxScopes: MAX_CACHED_CHAT_SCOPES,
    ttlMs: CHAT_CACHE_TTL_MS,
    version: CHAT_CACHE_VERSION,
  } as const

  const pinnedOrder = computed({
    get: () => {
      const userId = sessionStore.activeSession?.me?.id
      if (!userId) {
        return []
      }

      return readVersionedScopedCache(allPinnedOrders.value, String(userId), [], cacheOptions)
    },
    set: (v) => {
      const userId = sessionStore.activeSession?.me?.id
      if (!userId) {
        return
      }

      allPinnedOrders.value = writeVersionedScopedCache(allPinnedOrders.value, String(userId), v, cacheOptions)
    },
  })

  const chats = computed({
    get: () => {
      const userId = sessionStore.activeSession?.me?.id
      if (!userId)
        return []
      const list = readVersionedScopedCache(allChats.value, String(userId), [], cacheOptions).filter(chat => chat?.id != null)
      const pinnedRank = new Map(pinnedOrder.value.map((chatId, index) => [Number(chatId), index]))
      return [...list].sort((a, b) => {
        // Pinned chats first
        if (a.pinned && !b.pinned)
          return -1
        if (!a.pinned && b.pinned)
          return 1

        if (a.pinned && b.pinned) {
          return (pinnedRank.get(Number(a.id)) ?? Number.MAX_SAFE_INTEGER)
            - (pinnedRank.get(Number(b.id)) ?? Number.MAX_SAFE_INTEGER)
        }

        // Then by last message date
        const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0
        const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0
        return dateB - dateA
      })
    },
    set: (v) => {
      const userId = sessionStore.activeSession?.me?.id
      if (!userId)
        return

      allChats.value = writeVersionedScopedCache(allChats.value, String(userId), v, cacheOptions)
    },
  })

  const folders = computed({
    get: () => {
      const userId = sessionStore.activeSession?.me?.id
      if (!userId)
        return []
      return readVersionedScopedCache(allFolders.value, String(userId), [], cacheOptions)
    },
    set: (v) => {
      const userId = sessionStore.activeSession?.me?.id
      if (!userId)
        return

      allFolders.value = writeVersionedScopedCache(allFolders.value, String(userId), v, cacheOptions)
    },
  })

  function getChat(id: string) {
    return chats.value.find(chat => chat.id === Number(id))
  }

  function isSamePreviewSnapshot(a: CoreDialog, b: CoreDialog) {
    const timeA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0
    const timeB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0

    return (a.lastMessage ?? '') === (b.lastMessage ?? '')
      && timeA === timeB
  }

  function mergeDialogs(dialogs: CoreDialog[], options: { preserveUnreadCount?: boolean, syncPinnedOrder?: boolean } = {}) {
    const existingChats = new Map(chats.value.map(chat => [chat.id, chat]))

    if (options.syncPinnedOrder) {
      pinnedOrder.value = dialogs.filter(chat => chat.pinned).map(chat => Number(chat.id))
    }

    chats.value = dialogs.map((incomingChat) => {
      const existingChat = existingChats.get(incomingChat.id)
      if (!existingChat) {
        return incomingChat
      }

      const shouldReuseSenderName = !incomingChat.lastMessageFromName
        && !!existingChat.lastMessageFromName
        && isSamePreviewSnapshot(existingChat, incomingChat)

      return {
        ...incomingChat,
        ...(shouldReuseSenderName ? { lastMessageFromName: existingChat.lastMessageFromName } : {}),
        ...(options.preserveUnreadCount && existingChat.unreadCount != null
          ? { unreadCount: existingChat.unreadCount }
          : {}),
      }
    })
  }

  function syncPinnedOrder(pinnedDialogIds: number[]) {
    pinnedOrder.value = pinnedDialogIds.map(id => Number(id)).filter(Number.isFinite)
  }

  function getMessagePreview(message: CoreMessage) {
    const text = message.content?.trim()
    if (text) {
      return text
    }

    const media = message.media?.[0]
    if (!media) {
      return ''
    }

    switch (media.type) {
      case 'sticker':
        return media.emoji?.trim() || 'Sticker'
      case 'photo':
        return 'Photo'
      case 'document':
        if (media.mimeType?.startsWith('audio/')) {
          return 'Audio'
        }
        if (media.mimeType?.startsWith('video/')) {
          return 'Video'
        }
        return 'File'
      case 'webpage':
        return media.title?.trim() || 'Link'
      default:
        return 'Message'
    }
  }

  function updateChatPreviewFromMessages(
    messages: CoreMessage[],
    options: {
      activeChatId?: string
      currentUserId?: string
      incrementUnread?: boolean
    } = {},
  ) {
    if (messages.length === 0) {
      return
    }

    const nextChats = [...chats.value]
    let hasChanges = false

    for (const message of messages) {
      const chatId = Number(message.chatId)
      if (!Number.isFinite(chatId)) {
        continue
      }

      const chatIndex = nextChats.findIndex(chat => chat.id === chatId)
      if (chatIndex < 0) {
        continue
      }

      const chat = nextChats[chatIndex]
      const messageDate = new Date(message.platformTimestamp * 1000)
      const currentDate = chat.lastMessageDate ? new Date(chat.lastMessageDate) : undefined

      if (currentDate && currentDate.getTime() > messageDate.getTime()) {
        continue
      }

      nextChats[chatIndex] = {
        ...chat,
        lastMessageFromName: message.fromName,
        lastMessage: getMessagePreview(message),
        lastMessageDate: messageDate,
        unreadCount: options.activeChatId === message.chatId
          ? 0
          : options.incrementUnread && options.currentUserId !== message.fromId
            ? (chat.unreadCount ?? 0) + 1
            : chat.unreadCount,
      }
      hasChanges = true
    }

    if (hasChanges) {
      chats.value = nextChats
    }
  }

  function fetchStorageDialogs() {
    bridge.sendEvent(CoreEventType.StorageFetchDialogs)
  }

  function fetchDialogs() {
    bridge.sendEvent(CoreEventType.DialogFetch)
  }

  function fetchFolders() {
    logger.log('Fetching folders')
    bridge.sendEvent(CoreEventType.DialogFoldersFetch)
  }

  function init() {
    logger.log('Init dialogs')

    fetchStorageDialogs()
    fetchDialogs()
    fetchFolders()
  }

  return {
    init,
    getChat,
    mergeDialogs,
    syncPinnedOrder,
    fetchDialogs,
    fetchStorageDialogs,
    fetchFolders,
    updateChatPreviewFromMessages,
    chats,
    folders,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot))
}
