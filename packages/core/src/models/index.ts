import type { AccountJoinedChatModels } from './account-joined-chats'
import type { AccountSettingsModels } from './account-settings'
import type { AccountModels } from './accounts'
import type { ChatMessageModels } from './chat-message'
import type { ChatMessageStatsModels } from './chat-message-stats'
import type { ChatModels } from './chats'
import type { PhotoModels } from './photos'
import type { StickerModels } from './stickers'
import type { UserModels } from './users'

import { accountJoinedChatModels } from './account-joined-chats'
import { accountSettingsModels } from './account-settings'
import { accountModels } from './accounts'
import { chatMessageModels } from './chat-message'
import { chatMessageStatsModels } from './chat-message-stats'
import { chatModels } from './chats'
import { photoModels } from './photos'
import { stickerModels } from './stickers'
import { userModels } from './users'

export const models = {
  chatMessageModels,
  chatMessageStatsModels,
  chatModels,
  photoModels,
  stickerModels,
  userModels,
  accountJoinedChatModels,
  accountSettingsModels,
  accountModels,
}

export type Models = typeof models
export type {
  AccountJoinedChatModels,
  AccountModels,
  AccountSettingsModels,
  ChatMessageModels,
  ChatMessageStatsModels,
  ChatModels,
  PhotoModels,
  StickerModels,
  UserModels,
}
