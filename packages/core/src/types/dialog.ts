export type DialogType = 'user' | 'group' | 'channel'

export interface CoreDialog {
  id: number
  name: string
  type: DialogType
  unreadCount?: number
  messageCount?: number
  lastMessage?: string
  lastMessageDate?: Date
  // Optional avatar metadata and client blob url
  avatarFileId?: string
  avatarUpdatedAt?: Date
  avatarBlobUrl?: string
  pinned?: boolean
  accessHash?: string
}
