export type DialogType = 'user' | 'bot' | 'group' | 'channel' | 'supergroup'

export interface CoreChatFolder {
  id: number
  title: string
  emoticon?: string
  pinnedChatIds?: number[]
  includedChatIds: number[]
  excludedChatIds: number[]
  contacts?: boolean
  nonContacts?: boolean
  groups?: boolean
  broadcasts?: boolean
  bots?: boolean
  excludeMuted?: boolean
  excludeRead?: boolean
  excludeArchived?: boolean
}

export interface CoreDialog {
  id: number
  name: string
  type: DialogType
  isContact?: boolean
  unreadCount?: number
  messageCount?: number
  lastMessage?: string
  lastMessageDate?: Date
  // Optional avatar metadata and client blob url
  avatarFileId?: string
  avatarUpdatedAt?: Date
  avatarBlobUrl?: string
  pinned?: boolean
  folderIds?: number[]
  accessHash?: string
}
