import type { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import type { accountsTable } from '../../schemas/accounts'
import type { chatMessagesTable } from '../../schemas/chat-messages'
import type { joinedChatsTable } from '../../schemas/joined-chats'
import type { photosTable } from '../../schemas/photos'
import type { stickersTable } from '../../schemas/stickers'
import type { usersTable } from '../../schemas/users'

export type DBInsertAccountJoinedChat = typeof accountJoinedChatsTable.$inferInsert
export type DBSelectAccountJoinedChat = typeof accountJoinedChatsTable.$inferSelect

export type DBInsertAccount = typeof accountsTable.$inferInsert
export type DBSelectAccount = typeof accountsTable.$inferSelect

export interface DBSelectChatMessageStats {
  platform: string
  chat_id: string
  chat_name: string
  message_count: number
  first_message_id: number | null
  first_message_at: number | null
  latest_message_id: number | null
  latest_message_at: number | null
}

export type DBInsertMessage = typeof chatMessagesTable.$inferInsert
export type DBSelectMessage = typeof chatMessagesTable.$inferSelect

export type DBInsertChat = typeof joinedChatsTable.$inferInsert
export type DBSelectChat = typeof joinedChatsTable.$inferSelect

export type DBInsertPhoto = typeof photosTable.$inferInsert
export type DBSelectPhoto = typeof photosTable.$inferSelect

export type DBSelectSticker = typeof stickersTable.$inferSelect
export type DBInsertSticker = typeof stickersTable.$inferInsert

export type DBInsertUser = typeof usersTable.$inferInsert
export type DBSelectUser = typeof usersTable.$inferSelect
