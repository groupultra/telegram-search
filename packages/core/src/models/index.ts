import type { AccountJoinedChatModels } from './account-joined-chats'
import type { AccountSettingsModels } from './account-settings'
import type { AccountTelegramSessionModels } from './account-telegram-sessions'
import type { AccountModels } from './accounts'
import type { BotScheduledTaskModels } from './bot-scheduled-tasks'
import type { ChatFolderModels } from './chat-folders'
import type { ChatMessageModels } from './chat-message'
import type { ChatMessageStatsModels } from './chat-message-stats'
import type { ChatModels } from './chats'
import type { PhotoModels } from './photos'
import type { RuntimeLeaseModels } from './runtime-leases'
import type { StickerModels } from './stickers'
import type { SystemSettingsModels } from './system-settings'
import type { UserModels } from './users'
import type { WebPageModels } from './web-pages'

import { accountJoinedChatModels } from './account-joined-chats'
import { accountSettingsModels } from './account-settings'
import { accountTelegramSessionModels } from './account-telegram-sessions'
import { accountModels } from './accounts'
import { botScheduledTaskModels } from './bot-scheduled-tasks'
import { chatFolderModels } from './chat-folders'
import { chatMessageModels } from './chat-message'
import { chatMessageStatsModels } from './chat-message-stats'
import { chatModels } from './chats'
import { photoModels } from './photos'
import { runtimeLeaseModels } from './runtime-leases'
import { stickerModels } from './stickers'
import { systemSettingsModels } from './system-settings'
import { userModels } from './users'
import { webPageModels } from './web-pages'

export const models = {
  chatMessageModels,
  chatMessageStatsModels,
  chatModels,
  chatFolderModels,
  photoModels,
  stickerModels,
  userModels,
  accountJoinedChatModels,
  accountSettingsModels,
  accountTelegramSessionModels,
  accountModels,
  botScheduledTaskModels,
  runtimeLeaseModels,
  systemSettingsModels,
  webPageModels,
}

export type Models = typeof models
export type { AccountTelegramSessionRow } from './account-telegram-sessions'
export type { DBSelectBotScheduledTask } from './bot-scheduled-tasks'
export type {
  AccountJoinedChatModels,
  AccountModels,
  AccountSettingsModels,
  AccountTelegramSessionModels,
  BotScheduledTaskModels,
  ChatFolderModels,
  ChatMessageModels,
  ChatMessageStatsModels,
  ChatModels,
  PhotoModels,
  RuntimeLeaseModels,
  StickerModels,
  SystemSettingsModels,
  UserModels,
  WebPageModels,
}
