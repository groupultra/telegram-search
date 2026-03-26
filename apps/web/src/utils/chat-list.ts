import type { CoreChatFolder, CoreDialog } from '@tg-search/core'

export interface ChatPreview {
  sender: string
  text: string
}

export function filterChatsByQuery(chats: CoreDialog[], searchQuery: string) {
  if (!searchQuery) {
    return chats
  }

  const query = searchQuery.toLowerCase()
  return chats.filter(chat => (chat?.name || '').toLowerCase().includes(query))
}

export function matchesFolder(chat: CoreDialog, folder: CoreChatFolder) {
  const chatId = Number(chat.id)
  if (!Number.isFinite(chatId)) {
    return false
  }

  if (folder.excludedChatIds?.some(id => Number(id) === chatId)) {
    return false
  }

  if (folder.includedChatIds?.some(id => Number(id) === chatId) || folder.pinnedChatIds?.some(id => Number(id) === chatId)) {
    return true
  }

  if (chat.folderIds?.some(folderId => Number(folderId) === folder.id)) {
    return true
  }

  if (chat.type === 'user') {
    if (folder.contacts && chat.isContact) {
      return true
    }

    if (folder.nonContacts && !chat.isContact) {
      return true
    }
  }

  if (chat.type === 'bot' && folder.bots) {
    return true
  }

  if ((chat.type === 'group' || chat.type === 'supergroup') && folder.groups) {
    return true
  }

  if (chat.type === 'channel' && folder.broadcasts) {
    return true
  }

  return false
}

export function sortChatsForFolder(chats: CoreDialog[], folder: CoreChatFolder) {
  const pinnedOrder = new Map((folder.pinnedChatIds ?? []).map((chatId, index) => [Number(chatId), index]))
  const isPinnedInFolder = (chat: CoreDialog) => pinnedOrder.has(Number(chat.id))

  const byDateDesc = (a: CoreDialog, b: CoreDialog) => {
    const dateA = a?.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0
    const dateB = b?.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0
    return dateB - dateA
  }

  return [...chats].sort((a, b) => {
    const aPinned = isPinnedInFolder(a)
    const bPinned = isPinnedInFolder(b)

    if (aPinned && bPinned) {
      return (pinnedOrder.get(Number(a.id)) ?? Number.MAX_SAFE_INTEGER)
        - (pinnedOrder.get(Number(b.id)) ?? Number.MAX_SAFE_INTEGER)
    }

    if (aPinned && !bPinned) {
      return -1
    }

    if (!aPinned && bPinned) {
      return 1
    }

    return byDateDesc(a, b)
  })
}

export function getChatPreview(chat: CoreDialog): ChatPreview {
  const preview = chat.lastMessage?.trim() ?? ''
  const sender = chat.lastMessageFromName?.trim()
  const showSender = !!sender && !!preview && (chat.type === 'group' || chat.type === 'supergroup')

  return {
    sender: showSender ? sender : '',
    text: preview,
  }
}

export function formatChatTimestamp(value: Date | string | number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const isSameDay = now.getFullYear() === date.getFullYear()
    && now.getMonth() === date.getMonth()
    && now.getDate() === date.getDate()

  if (isSameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }

  if (now.getFullYear() === date.getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}
